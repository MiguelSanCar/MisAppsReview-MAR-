import initSqlJs from 'sql.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { get, run } from '../src/db';
import {
  baseOf, diffNews, isDue, isRelatedMovie, newsText, parseBase, parseSnap, ttlFor, type MovieSnap, type TvSnap,
} from '../src/domain/news';
import { MIGRATIONS } from '../src/migrations';
import { newsIdle } from '../src/news';
import { Client, startTestApp } from './client';

const tv = (status: string, seasons: [number, string | null, number][], related: any[] = []): TvSnap => ({
  kind: 'tv', status, firstAir: '2008-01-20', seasons: seasons.map(([n, air, eps]) => ({ n, air, eps })), related,
});
const TODAY = '2026-10-14';

describe('novedades: reglas puras', () => {
  it('la base fija lo ya conocido; sin cambios no hay novedades', () => {
    const snap = tv('Returning Series', [[1, '2020-01-01', 8], [2, '2022-01-01', 8]], [{ id: 5, title: 'X', date: '2021-01-01' }]);
    expect(baseOf(snap)).toEqual({ maxSeason: 2, related: [5] });
    expect(diffNews(baseOf(snap), snap, TODAY)).toEqual([]);
    expect(baseOf({ kind: 'movie', parts: [{ id: 1, title: 'A', date: null }, { id: 2, title: 'B', date: null }] })).toEqual({ maxSeason: 0, related: [1, 2] });
  });

  it('una temporada nueva es «anunciada» si aún no se ha estrenado y «disponible» si su fecha ya pasó', () => {
    const base = { maxSeason: 2, related: [] };
    const futura = diffNews(base, tv('Returning Series', [[1, '2020-01-01', 8], [2, '2022-01-01', 8], [3, '2027-03-01', 0]]), TODAY);
    expect(futura).toEqual([{ kind: 'season_announced', key: 's:3:a', season: 3, airDate: '2027-03-01' }]);
    const pasada = diffNews(base, tv('Returning Series', [[1, '2020-01-01', 8], [2, '2022-01-01', 8], [3, '2026-10-01', 8]]), TODAY);
    expect(pasada).toEqual([{ kind: 'season_released', key: 's:3:r', season: 3, airDate: '2026-10-01' }]);
    // estreno exactamente hoy: ya disponible
    expect(diffNews(base, tv('Returning Series', [[3, TODAY, 8]]), TODAY)[0].kind).toBe('season_released');
  });

  it('una temporada anunciada sin fecha pero con episodios se avisa; un hueco sin fecha ni episodios, no', () => {
    const base = { maxSeason: 1, related: [] };
    expect(diffNews(base, tv('Returning Series', [[1, '2020-01-01', 8], [2, null, 10]]), TODAY)).toEqual([{ kind: 'season_announced', key: 's:2:a', season: 2, airDate: null }]);
    expect(diffNews(base, tv('Returning Series', [[1, '2020-01-01', 8], [2, null, 0]]), TODAY)).toEqual([]);
  });

  it('lo que ya estaba en la base nunca es novedad, y la misma novedad tiene siempre la misma clave', () => {
    const base = { maxSeason: 3, related: [7] };
    const snap = tv('Returning Series', [[1, '2020-01-01', 8], [2, '2021-01-01', 8], [3, '2022-01-01', 8], [4, '2027-01-01', 0]], [{ id: 7, title: 'Vieja', date: '2020-01-01' }, { id: 8, title: 'Nueva', date: '2027-05-05' }]);
    const a = diffNews(base, snap, TODAY);
    expect(a.map((e) => e.key)).toEqual(['s:4:a', 'm:8']);
    expect(diffNews(base, snap, TODAY).map((e) => e.key)).toEqual(a.map((e) => e.key));
  });

  it('las películas nuevas de una saga y las relacionadas de una serie son «película relacionada»', () => {
    const peli: MovieSnap = { kind: 'movie', parts: [{ id: 1, title: 'Uno', date: '2010-01-01' }, { id: 2, title: 'Dos', date: '2013-01-01' }, { id: 3, title: 'Tres', date: '2099-01-01' }] };
    const ev = diffNews({ maxSeason: 0, related: [1, 2] }, peli, TODAY);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'related_movie', key: 'm:3', airDate: '2099-01-01', movie: { id: 3 } });
  });

  it('heurística de películas relacionadas: contiene el título, no es anterior ni un documental', () => {
    const ok = (title: string, date: string | null = '2019-10-11', genres?: number[]) => isRelatedMovie('Breaking Bad', '2008-01-20', { title, date, genres });
    expect(ok('El Camino: Una película de Breaking Bad')).toBe(true);
    expect(ok('Breaking Bad: La película')).toBe(true);
    expect(ok('BREAKING-BAD the movie')).toBe(true);
    expect(ok('Breaking Bad', null)).toBe(true); // sin fecha: aún no anunciada
    expect(ok('Otra cosa distinta')).toBe(false);
    expect(ok('Breaking Badass')).toBe(false); // no son palabras completas
    expect(ok('Breaking Bad: documental', '2019-01-01')).toBe(false);
    expect(ok('Cómo se hizo Breaking Bad (making of)')).toBe(false);
    expect(ok('Breaking Bad', '2019-10-11', [99])).toBe(false); // género documental
    expect(ok('Breaking Bad: el origen', '1999-01-01')).toBe(false); // anterior a la serie
    expect(isRelatedMovie('Yo', '2020-01-01', { title: 'Yo y yo', date: null })).toBe(false); // título demasiado corto
    expect(isRelatedMovie('Amélie', null, { title: 'AMELIE: la serie', date: null })).toBe(true); // sin acentos ni mayúsculas
  });

  it('las series en emisión se revisan cada 12 h; las terminadas y las películas, cada 7 días; lo no consultado, ya', () => {
    const cfg = { activeMs: 12 * 3600_000, idleMs: 7 * 86400_000 };
    const now = Date.now();
    const activa = tv('Returning Series', [[1, '2020-01-01', 8]]);
    const fin = tv('Ended', [[1, '2020-01-01', 8]]);
    const peli: MovieSnap = { kind: 'movie', parts: [] };
    expect(ttlFor(activa, cfg)).toBe(cfg.activeMs);
    expect(ttlFor(tv('In Production', []), cfg)).toBe(cfg.activeMs);
    expect(ttlFor(fin, cfg)).toBe(cfg.idleMs);
    expect(ttlFor(tv('Canceled', []), cfg)).toBe(cfg.idleMs);
    expect(ttlFor(peli, cfg)).toBe(cfg.idleMs);
    expect(isDue(null, null, now, cfg)).toBe(true);
    expect(isDue(activa, now - 13 * 3600_000, now, cfg)).toBe(true);
    expect(isDue(activa, now - 11 * 3600_000, now, cfg)).toBe(false);
    expect(isDue(fin, now - 13 * 3600_000, now, cfg)).toBe(false); // una terminada no se vuelve a pedir en el día
    expect(isDue(fin, now - 8 * 86400_000, now, cfg)).toBe(true);
  });

  it('los textos de los avisos', () => {
    expect(newsText({ kind: 'season_announced', season: 3, airDate: '2027-03-01' }, TODAY)).toBe('Temporada 3 anunciada · estreno 1 mar 2027');
    expect(newsText({ kind: 'season_announced', season: 3, airDate: null }, TODAY)).toBe('Temporada 3 anunciada');
    expect(newsText({ kind: 'season_released', season: 2 }, TODAY)).toBe('Temporada 2 ya disponible');
    expect(newsText({ kind: 'related_movie', title: 'El Camino', airDate: '2019-10-11' }, TODAY)).toBe('Película relacionada: «El Camino» · estrenada 11 oct 2019');
    expect(newsText({ kind: 'related_movie', title: 'El Camino', airDate: '2027-01-05' }, TODAY)).toBe('Película relacionada: «El Camino» · estreno 5 ene 2027');
    expect(newsText({ kind: 'related_movie', title: 'Tres', airDate: null }, TODAY, true)).toBe('Nueva película de la saga: «Tres»');
  });

  it('lee instantáneas y bases dañadas sin romperse', () => {
    expect(parseSnap(null)).toBeNull();
    expect(parseSnap('basura')).toBeNull();
    expect(parseSnap('{"kind":"otra"}')).toBeNull();
    expect(parseBase('{"maxSeason":2,"related":[1]}')).toEqual({ maxSeason: 2, related: [1] });
    expect(parseBase('{"x":1}')).toBeNull();
  });
});

describe('novedades: API y motor', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const ana = new Client();
  const beto = new Client();
  let anaId = 0;
  let bb: any;
  let peli: any;
  const mock = () => app.mock.state;

  /** Pide las notificaciones, espera a que termine el cálculo en segundo plano y las vuelve a pedir. */
  async function refresh(c = ana, id = anaId) {
    await c.get('/api/notifications');
    await newsIdle(id);
    return (await c.get('/api/notifications')).body;
  }

  beforeAll(async () => {
    app = await startTestApp();
    Object.assign(config, { newsUserIntervalMs: 0, newsTtlActiveMs: 0, newsTtlIdleMs: 0, newsRelatedTtlMs: 0, newsRoundDelayMs: 0 });
    anaId = (await ana.post('/api/auth/register', { username: 'ana', email: 'ana@test.com', password: 'secreto123' })).body.user.id;
    await beto.post('/api/auth/register', { username: 'beto', email: 'beto@test.com', password: 'secreto123' });
    const res = (await ana.get('/api/search?q=prueba&type=todo')).body.results;
    bb = res.find((x: any) => x.title === 'Breaking Bad');
    peli = res.find((x: any) => x.externalId === 'movie-101');
    await ana.put(`/api/library/${bb.id}/status`, { status: 'FINALIZADO' });
    await ana.put(`/api/library/${bb.id}/favorite`, { value: true });
    await ana.put(`/api/library/${peli.id}/status`, { status: 'FINALIZADO' });
    mock().collections[101] = { id: 5, parts: [{ id: 101, title: 'Pelicula 1', release_date: '2010-01-01', poster_path: '/p.jpg' }] };
  });
  afterAll(() => app.stop());

  it('sin sesión no hay notificaciones', async () => {
    expect((await new Client().get('/api/notifications')).status).toBe(401);
    expect((await new Client().post('/api/notifications/seen')).status).toBe(401);
  });

  it('la primera vez solo se fija la base: lo que ya existía no genera avisos', async () => {
    const first = await ana.get('/api/notifications');
    expect(first.status).toBe(200);
    expect(first.body.checking).toBe(true); // el cálculo va en segundo plano
    expect(first.body.items).toEqual([]);
    await newsIdle(anaId);
    const r = (await ana.get('/api/notifications')).body;
    expect(r).toMatchObject({ items: [], unseen: 0, favoritesOnly: false, introSeen: false });
    const bases = (await import('../src/db')).all<{ news_base: string | null }>('SELECT news_base FROM user_content WHERE user_id = ?', [anaId]);
    expect(bases).toHaveLength(2);
    expect(bases.every((b) => b.news_base)).toBe(true);
    expect(JSON.parse(bases.find((b) => JSON.parse(b.news_base!).maxSeason === 5)!.news_base!)).toEqual({ maxSeason: 5, related: [] });
  });

  it('una temporada anunciada genera un aviso con su fecha, que lleva al contenido', async () => {
    mock().extraSeasons[1396] = [{ season_number: 6, episode_count: 0, air_date: '2099-01-01' }];
    mock().status[1396] = 'Returning Series';
    const r = await refresh();
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ kind: 'season_announced', title: 'Breaking Bad', text: 'Temporada 6 anunciada · estreno 1 ene 2099', seen: false, contentId: bb.id });
    expect(r.unseen).toBe(1);
  });

  it('el mismo aviso no se repite aunque se vuelva a calcular', async () => {
    const r = await refresh();
    expect(r.items).toHaveLength(1);
    expect(r.unseen).toBe(1);
  });

  it('cuando la temporada se estrena llega un segundo aviso («ya disponible»)', async () => {
    mock().extraSeasons[1396] = [{ season_number: 6, episode_count: 8, air_date: '2024-05-05' }];
    const r = await refresh();
    expect(r.items.map((i: any) => i.text)).toEqual(['Temporada 6 ya disponible', 'Temporada 6 anunciada · estreno 1 ene 2099']);
    expect(r.unseen).toBe(2);
  });

  it('marcar como vistas deja el contador a 0 sin borrar la lista; lo siguiente vuelve a contar', async () => {
    const s = await ana.post('/api/notifications/seen');
    expect(s.body).toMatchObject({ ok: true, marked: 2 });
    let r = (await ana.get('/api/notifications')).body;
    expect(r.unseen).toBe(0);
    expect(r.items.every((i: any) => i.seen)).toBe(true);
    expect(r.items).toHaveLength(2);
    mock().extraSeasons[1396].push({ season_number: 7, episode_count: 0, air_date: '2100-02-02' });
    r = await refresh();
    expect(r.unseen).toBe(1);
    expect(r.items[0].text).toBe('Temporada 7 anunciada · estreno 2 feb 2100');
  });

  it('una película relacionada de una serie se detecta por el título y se descartan los falsos positivos', async () => {
    mock().movieSearch = [
      { id: 999001, title: 'Breaking Bad: La película', release_date: '2019-10-11', popularity: 50, genre_ids: [80], overview: 'Secuela', poster_path: '/x.jpg' },
      { id: 999002, title: 'Cómo se hizo Breaking Bad: making of', release_date: '2019-10-12', popularity: 60, genre_ids: [99] },
      { id: 999003, title: 'Algo sin relación', release_date: '2020-01-01', popularity: 90, genre_ids: [18] },
    ];
    const r = await refresh();
    const rel = r.items.filter((i: any) => i.kind === 'related_movie');
    expect(rel).toHaveLength(1);
    expect(rel[0].text).toBe('Película relacionada: «Breaking Bad: La película» · estrenada 11 oct 2019');
    expect(rel[0].title).toBe('Breaking Bad'); // el contenido de la lista que lo origina
    expect(rel[0].contentId).not.toBe(bb.id); // lleva a la página de la película
    const row = get<{ title: string; type: string; year: number }>('SELECT title, type, year FROM content WHERE id = ?', [rel[0].contentId])!;
    expect(row).toMatchObject({ title: 'Breaking Bad: La película', type: 'pelicula', year: 2019 });
  });

  it('una película nueva de la saga de otra película también avisa, con su propio texto', async () => {
    mock().collections[101].parts.push({ id: 777, title: 'Pelicula 1: Secuela', release_date: '2099-02-02', poster_path: '/s.jpg' });
    const r = await refresh();
    const saga = r.items.find((i: any) => i.text.startsWith('Nueva película de la saga'));
    expect(saga.text).toBe('Nueva película de la saga: «Pelicula 1: Secuela» · estreno 2 feb 2099');
    expect(saga.title).toBe('Pelicula 1');
  });

  it('«solo favoritos» filtra avisos y contador; desactivarlo los devuelve', async () => {
    const todos = (await ana.get('/api/notifications')).body;
    expect(todos.items.length).toBeGreaterThanOrEqual(4);
    const put = await ana.put('/api/me/notifications', { favoritesOnly: true });
    expect(put.body.user).toMatchObject({ notifFavoritesOnly: true, notifIntroSeen: false });
    const fav = (await ana.get('/api/notifications')).body;
    expect(fav.favoritesOnly).toBe(true);
    expect(fav.items.length).toBeLessThan(todos.items.length);
    expect(fav.items.every((i: any) => i.title === 'Breaking Bad')).toBe(true); // la película de la saga no es favorita
    expect(fav.unseen).toBeLessThanOrEqual(todos.unseen);
    await ana.put('/api/me/notifications', { favoritesOnly: false, introSeen: true });
    const otra = (await ana.get('/api/notifications')).body;
    expect(otra.items).toHaveLength(todos.items.length);
    expect(otra.introSeen).toBe(true);
    expect((await ana.get('/api/auth/me')).body.user).toMatchObject({ notifFavoritesOnly: false, notifIntroSeen: true });
  });

  it('valida los ajustes', async () => {
    expect((await ana.put('/api/me/notifications', { favoritesOnly: 'si' })).status).toBe(400);
    expect((await ana.put('/api/me/notifications', { introSeen: 1 })).status).toBe(400);
    expect((await new Client().put('/api/me/notifications', { favoritesOnly: true })).status).toBe(401);
  });

  it('quitar el contenido de la lista oculta sus avisos', async () => {
    const antes = (await ana.get('/api/notifications')).body.items.length;
    await ana.del(`/api/library/${peli.id}`);
    const despues = (await ana.get('/api/notifications')).body.items;
    expect(despues.length).toBe(antes - 1);
    expect(despues.some((i: any) => i.title === 'Pelicula 1')).toBe(false);
  });

  it('cada persona ve solo lo suyo y no puede marcar lo ajeno', async () => {
    const betoRes = (await beto.get('/api/notifications')).body;
    expect(betoRes.items).toEqual([]);
    expect(betoRes.unseen).toBe(0);
    const marked = await beto.post('/api/notifications/seen');
    expect(marked.body.marked).toBe(0);
    expect((await ana.get('/api/notifications')).body.items.length).toBeGreaterThan(0);
  });

  it('eliminar un aviso lo oculta y lo da por visto; no se puede eliminar el ajeno ni repetir', async () => {
    const antes = (await ana.get('/api/notifications')).body;
    const id = antes.items[0].id;
    expect((await new Client().del(`/api/notifications/${id}`)).status).toBe(401);
    expect((await beto.del(`/api/notifications/${id}`)).status).toBe(404);
    expect((await ana.del('/api/notifications/abc')).status).toBe(400);
    expect((await ana.del(`/api/notifications/${id}`)).status).toBe(200);
    expect((await ana.del(`/api/notifications/${id}`)).status).toBe(404);
    const despues = (await ana.get('/api/notifications')).body;
    expect(despues.items.length).toBe(antes.items.length - 1);
    expect(despues.items.some((i: any) => i.id === id)).toBe(false);
    expect(despues.unseen).toBeLessThanOrEqual(antes.unseen);
  });

  it('una persona que añade el contenido después parte de lo que ya existía (sin avisos del pasado)', async () => {
    await beto.put(`/api/library/${bb.id}/status`, { status: 'VIENDO' });
    const id = (await beto.get('/api/auth/me')).body.user.id;
    const r = await refresh(beto, id);
    expect(r.items).toEqual([]); // la temporada 6 y 7 ya existían cuando la añadió
    mock().extraSeasons[1396].push({ season_number: 8, episode_count: 0, air_date: '2101-03-03' });
    const r2 = await refresh(beto, id);
    expect(r2.items.map((i: any) => i.text)).toEqual(['Temporada 8 anunciada · estreno 3 mar 2101']);
  });
});

describe('novedades: rendimiento (no perjudica al resto de la aplicación)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const ana = new Client();
  const beto = new Client();
  let anaId = 0;
  let betoId = 0;
  const N = 90;

  beforeAll(async () => {
    app = await startTestApp();
    Object.assign(config, { newsUserIntervalMs: 60_000, newsTtlActiveMs: 1e12, newsTtlIdleMs: 1e12, newsRelatedTtlMs: 1e12, newsRoundDelayMs: 0, newsBudget: 30, newsConcurrency: 3 });
    anaId = (await ana.post('/api/auth/register', { username: 'ana', email: 'ana@test.com', password: 'secreto123' })).body.user.id;
    betoId = (await beto.post('/api/auth/register', { username: 'beto', email: 'beto@test.com', password: 'secreto123' })).body.user.id;
    for (let i = 0; i < N; i++) {
      const { lastId } = run("INSERT INTO content (source, external_id, type, title, detailed_at) VALUES ('tmdb', ?, 'serie', ?, '2026-01-01')", [`tv-${5000 + i}`, `Serie ${i}`]);
      for (const u of [anaId, betoId]) run("INSERT INTO user_content (user_id, content_id, status, watched_episodes, is_favorite, updated_at) VALUES (?, ?, 'VIENDO', 1, 0, '2026-01-01T00:00:00.000Z')", [u, lastId]);
    }
    app.mock.state.delayMs = 40; // cada respuesta de TMDB tarda 40 ms
  });
  afterAll(() => app.stop());

  const ms = async (fn: () => Promise<unknown>) => { const t = performance.now(); await fn(); return performance.now() - t; };

  it('la petición de la campana vuelve al instante aunque haya que calcular 90 contenidos', async () => {
    const t = await ms(async () => {
      const r = await ana.get('/api/notifications');
      expect(r.body.checking).toBe(true);
    });
    expect(t).toBeLessThan(150); // sin esperar a TMDB (90 consultas × 40 ms tardarían más de un segundo)
  });

  it('mientras se calcula, el resto de la API sigue respondiendo con rapidez', async () => {
    const lat: number[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 3000 && (await import('../src/news')).isChecking(anaId)) {
      lat.push(await ms(() => ana.get('/api/health')));
      lat.push(await ms(() => ana.get('/api/library?limit=5')));
    }
    expect(lat.length).toBeGreaterThan(4); // se midió de verdad durante el cálculo
    expect(Math.max(...lat)).toBeLessThan(120);
  });

  it('respeta el límite global de peticiones simultáneas a TMDB y termina todo en rondas', async () => {
    await newsIdle(anaId);
    expect(app.mock.state.maxActive).toBeLessThanOrEqual(3);
    expect(app.mock.state.maxActive).toBeGreaterThanOrEqual(2); // y sí hay paralelismo
    const faltan = (await import('../src/db')).all<{ external_id: string; news_at: string | null }>("SELECT external_id, news_at FROM content WHERE news IS NULL AND external_id LIKE 'tv-5%'");
    expect(faltan).toEqual([]);
  });

  it('no se programa otro refresco hasta que pasa el intervalo por persona', async () => {
    const calls = app.mock.calls.length;
    const r = await ana.get('/api/notifications');
    expect(r.body.checking).toBe(false);
    await ana.get('/api/notifications');
    expect(app.mock.calls.length).toBe(calls);
  });

  it('la instantánea se comparte: otra persona con los mismos contenidos no vuelve a pedir nada a TMDB', async () => {
    const calls = app.mock.calls.length;
    await beto.get('/api/notifications');
    await newsIdle(betoId);
    expect(app.mock.calls.length).toBe(calls); // todo estaba fresco: cero peticiones
    const sinBase = (await import('../src/db')).all<{ external_id: string; news: string | null }>('SELECT c.external_id, c.news FROM user_content uc JOIN content c ON c.id = uc.content_id WHERE uc.user_id = ? AND uc.news_base IS NULL', [betoId]);
    expect(sinBase.map((x) => [x.external_id, !!x.news])).toEqual([]); // y aun así parte de su base
  });

  it('un contenido que falla no bloquea al resto y se reintenta pasado un rato', async () => {
    const app2 = app.mock.state;
    app2.delayMs = 0;
    run("UPDATE content SET news_at = NULL, news = NULL WHERE external_id IN ('tv-5000', 'tv-5001')");
    run("UPDATE content SET external_id = 'tv-abc' WHERE external_id = 'tv-5000'"); // identificador roto: TMDB lo rechaza
    config.newsUserIntervalMs = 0;
    await ana.get('/api/notifications');
    await newsIdle(anaId);
    const ok = get<{ news: string | null }>("SELECT news FROM content WHERE external_id = 'tv-5001'")!;
    const roto = get<{ news: string | null }>("SELECT news FROM content WHERE external_id = 'tv-abc'")!;
    expect(ok.news).toBeTruthy();
    expect(roto.news).toBeNull();
  });
});

describe('migración 13', () => {
  it('añade las columnas y la tabla sin tocar lo existente', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    MIGRATIONS.filter((m) => m.version <= 12).forEach((m) => db.exec(m.sql));
    db.run("INSERT INTO users (username, email, password_hash, created_at) VALUES ('vieja','v@t.com','x','2026-01-01')");
    db.exec(MIGRATIONS.find((m) => m.version === 13)!.sql);
    expect(db.exec("SELECT notif_favorites_only, notif_intro_seen, news_checked_at FROM users")[0].values[0]).toEqual([0, 0, null]);
    expect(db.exec("SELECT name FROM sqlite_master WHERE name = 'notifications'")[0].values).toHaveLength(1);
  });
});
