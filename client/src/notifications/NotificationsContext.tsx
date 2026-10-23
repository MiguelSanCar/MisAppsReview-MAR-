import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { Me } from '../types';

export interface NotificationItem {
  id: number;
  kind: 'season_announced' | 'season_released' | 'related_movie' | 'season_removed' | 'movie_removed';
  /** Texto del aviso (lo compone el servidor). */
  text: string;
  /** Contenido de tu lista que lo origina. */
  title: string;
  createdAt: string;
  seen: boolean;
  /** Página a la que lleva (la película nueva, si es una película relacionada). */
  contentId: number;
  posterUrl: string | null;
}

export interface NotificationsData {
  items: NotificationItem[];
  unseen: number;
  favoritesOnly: boolean;
  introSeen: boolean;
  /** El servidor está calculando novedades en segundo plano: conviene volver a preguntar. */
  checking: boolean;
}

interface Value extends NotificationsData {
  loaded: boolean;
  reload: () => Promise<NotificationsData | null>;
  markSeen: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  savePrefs: (p: { favoritesOnly?: boolean; introSeen?: boolean }) => Promise<NotificationsData | null>;
}

const EMPTY: NotificationsData = { items: [], unseen: 0, favoritesOnly: false, introSeen: true, checking: false };
const Ctx = createContext<Value>({ ...EMPTY, loaded: false, reload: async () => null, markSeen: async () => {}, dismiss: async () => {}, savePrefs: async () => null });
export const useNotifications = () => useContext(Ctx);

const POLL_MS = 5 * 60_000;
const MIN_FOCUS_GAP_MS = 60_000;
const FOLLOW_UPS = 4;

/**
 * Notificaciones de novedades. La lectura es instantánea (el servidor solo consulta su base de datos); si está
 * calculando algo en segundo plano (`checking`) se vuelve a preguntar unas pocas veces con pausas crecientes. Después,
 * cada 5 minutos y al volver a la pestaña (como mucho una vez por minuto). Sin sesión no se pide nada.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [data, setData] = useState<NotificationsData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const followUps = useRef(0);
  const timer = useRef<number>();
  const lastLoad = useRef(0);
  const uid = user?.id;

  const reload = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const r = await api.get<NotificationsData>('/api/notifications');
      setData(r);
      setLoaded(true);
      window.clearTimeout(timer.current);
      if (r.checking && followUps.current < FOLLOW_UPS) {
        followUps.current++;
        timer.current = window.setTimeout(() => { reload(); }, 2500 * followUps.current);
      } else if (!r.checking) {
        followUps.current = 0;
      }
      return r;
    } catch {
      return null; // sin conexión o servidor ocupado: se reintenta en el siguiente ciclo
    }
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    followUps.current = 0;
    if (!uid) { setData(EMPTY); setLoaded(false); return; }
    reload();
    const iv = window.setInterval(reload, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > MIN_FOCUS_GAP_MS) reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(iv); window.clearTimeout(timer.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [uid, reload]);

  const markSeen = useCallback(async () => {
    try {
      await api.post('/api/notifications/seen');
      setData((d) => ({ ...d, unseen: 0, items: d.items.map((i) => ({ ...i, seen: true })) }));
    } catch { /* se marcará la próxima vez */ }
  }, []);

  /** Elimina un aviso (queda visto y oculto). Se quita al momento de la lista; si falla, se vuelve a leer. */
  const dismiss = useCallback(async (id: number) => {
    setData((d) => {
      const gone = d.items.find((i) => i.id === id);
      return { ...d, items: d.items.filter((i) => i.id !== id), unseen: gone && !gone.seen ? Math.max(0, d.unseen - 1) : d.unseen };
    });
    try { await api.del(`/api/notifications/${id}`); } catch { reload(); }
  }, [reload]);

  const savePrefs = useCallback(async (p: { favoritesOnly?: boolean; introSeen?: boolean }) => {
    const r = await api.put<{ user: Me }>('/api/me/notifications', p);
    setUser(r.user);
    return reload();
  }, [setUser, reload]);

  const value = useMemo<Value>(() => ({ ...data, loaded, reload, markSeen, dismiss, savePrefs }), [data, loaded, reload, markSeen, dismiss, savePrefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
