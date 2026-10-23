import { Router } from 'express';
import { all, get, run } from '../db';
import { newsText } from '../domain/news';
import { HttpError } from '../http';
import { isChecking, requestNewsRefresh } from '../news';
import { requireAuth, uid } from './auth';

/**
 * Notificaciones de novedades. Estas rutas solo LEEN de la base de datos y vuelven al instante: el cálculo (que
 * consulta TMDB) se programa en segundo plano en `news.ts`. `checking` avisa al cliente de que conviene volver a
 * preguntar poco después.
 */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

interface Row {
  id: number;
  kind: string;
  season: number | null;
  air_date: string | null;
  related_title: string | null;
  created_at: string;
  seen_at: string | null;
  content_id: number;
  related_content_id: number | null;
  source_title: string;
  source_type: string;
  poster_url: string | null;
  related_poster: string | null;
}

const LIMIT = 50;

/** Una persona ve los avisos de los contenidos que SIGUE teniendo en su lista (y, si lo pide, solo de sus favoritos). */
const FROM = `FROM notifications n
  LEFT JOIN user_content uc ON uc.user_id = n.user_id AND uc.content_id = n.content_id
  JOIN content c ON c.id = n.content_id
  LEFT JOIN content rc ON rc.id = n.related_content_id
  WHERE n.user_id = ? AND n.dismissed_at IS NULL AND (uc.user_id IS NOT NULL OR n.kind = 'movie_removed')`;

notificationsRouter.get('/', (req, res) => {
  const me = uid(req);
  const user = get<{ notif_favorites_only: number; notif_intro_seen: number }>('SELECT notif_favorites_only, notif_intro_seen FROM users WHERE id = ?', [me])!;
  const checking = requestNewsRefresh(me) || isChecking(me);
  const only = user.notif_favorites_only ? ' AND uc.is_favorite = 1' : '';
  const rows = all<Row>(
    `SELECT n.id, n.kind, n.season, n.air_date, n.related_title, n.created_at, n.seen_at, n.content_id, n.related_content_id,
            c.title AS source_title, c.type AS source_type, c.poster_url, rc.poster_url AS related_poster
     ${FROM}${only} ORDER BY n.created_at DESC, n.id DESC LIMIT ?`,
    [me, LIMIT],
  );
  const unseen = get<{ n: number }>(`SELECT COUNT(*) AS n ${FROM}${only} AND n.seen_at IS NULL`, [me])!.n;
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      text: newsText({ kind: r.kind as any, season: r.season ?? undefined, airDate: r.air_date, title: r.related_title ?? '' }, today, r.source_type === 'pelicula'),
      title: r.source_title,
      createdAt: r.created_at,
      seen: !!r.seen_at,
      /** Página a la que lleva: la película nueva si la hay; si no, el contenido de la lista. */
      contentId: r.related_content_id ?? r.content_id,
      posterUrl: r.related_poster ?? r.poster_url,
    })),
    unseen,
    favoritesOnly: !!user.notif_favorites_only,
    introSeen: !!user.notif_intro_seen,
    checking,
  });
});

/** Marca todo como visto (botón «Visto» del panel). */
notificationsRouter.post('/seen', (req, res) => {
  const { changes } = run('UPDATE notifications SET seen_at = ? WHERE user_id = ? AND seen_at IS NULL', [new Date().toISOString(), uid(req)]);
  res.json({ ok: true, marked: changes });
});

/** Elimina un aviso (botón «×» o arrastrarlo): queda visto y oculto; la fila se conserva para que no se vuelva a crear. */
notificationsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Notificación no válida');
  const now = new Date().toISOString();
  const { changes } = run(
    'UPDATE notifications SET dismissed_at = ?, seen_at = COALESCE(seen_at, ?) WHERE id = ? AND user_id = ? AND dismissed_at IS NULL',
    [now, now, id, uid(req)],
  );
  if (!changes) throw new HttpError(404, 'Notificación no encontrada');
  res.json({ ok: true });
});
