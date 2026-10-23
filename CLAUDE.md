# Instrucciones

## Forma de programación

 - Siempre que te diga un cambio, añádelo al Roadmap en la prioridad que te he dicho; en caso de no habértela dado, asúmela según las demás tareas (puedes fraccionar, renumerar y reordenar).

 - Siempre que te diga cambios, NO rompas el ciclo de desarrollo: sigue con el roadmap y para SOLO cuando lo hayas finalizado. Quedan fuera de ese "finalizado" las tareas que dependan de algo externo (p. ej. una cuenta de hosting) o que yo haya dejado en espera / prioridad baja; al terminar, enuméralas.

 - Documenta TODO, modifica el README cuando lo requiera y sube los cambios periódicamente a GitHub (`origin/main`). Commits pequeños con Conventional Commits. Nunca subas `.env`, bases de datos (`data/`, `*.db`), `certs/` ni `tools/` (ya están en `.gitignore`).

## Proyecto

MAR (Mis Apps Review): app web personal para registrar series, películas y anime (vistos, en curso, pendientes), con perfil, amigos, listas conjuntas y un roadmap público. Hecha con Claude Code como prueba. Todo en español (interfaz, mensajes de error, documentación y respuestas); código y nombres técnicos en inglés/español según el contexto del fichero.

Visión general: `README.md` (orientado a GitHub: no se dirige al autor ni menciona su entorno). Detalle: `docs/ARQUITECTURA.md`, `docs/API.md`, `docs/DESARROLLO.md`, `docs/DESPLIEGUE.md`, `docs/DECISIONES.md`, `docs/CHANGELOG.md`. Este fichero solo recoge lo que no está allí. Si cambia algo visible o un endpoint, actualizar README y/o `docs/API.md`.

## Entorno (restricciones)

 - Windows, **Node 16.20.2** / npm 8. Todo debe funcionar ahí: Vite 4, Vitest 0.34, `ts-node-dev` (nada que exija Node 18+, ni `tsx`, ni `fetch` global: usar `getJson` de `server/src/http.ts`).
 - Git: usar `git`; si no responde, ver `CLAUDE.local.md` (no versionado).
 - Si la red re-firma HTTPS, Node necesita un PEM propio (`scripts/ca.js`, ver README). Nunca desactivar la verificación TLS. Los detalles del equipo concreto están en `CLAUDE.local.md` (ignorado por git; no copiar su contenido a ficheros versionados).
 - PowerShell está en modo restringido (no se pueden llamar métodos .NET): usar cmdlets.
 - El `.env` real tiene `JWT_SECRET`, `TMDB_API_KEY`, `OMDB_API_KEY` y (cuando exista) `MAL_CLIENT_ID`: no los imprimas ni los copies a otros ficheros.

## Comandos

```bash
npm run dev                       # API :3001 (también sirve client/dist) + Vite :5173 con proxy /api
npm run share                     # túnel Cloudflare a :3001 (requiere `npm run dev` y tools/cloudflared); se niega con el JWT_SECRET por defecto
npm test                          # Vitest del servidor
npm run build                     # client/dist y server/dist
npm run dev:mock -w server        # app con TMDB/MyAnimeList/OMDb simulados en :3101 (necesita build del cliente; `MOCK_SEED=300` crea el usuario «carga», `MOCK_DEMO=1 MOCK_PORT=3102` el modo demostración para `scripts/capturas.js`); JOINT_INACTIVITY_DAYS / JOINT_WARNING_DAYS cortos para probar avisos
npm run mail:test -w server -- tu@correo.com   # comprueba SMTP (base lista, aún sin usar)
```

## Arquitectura

 - `server/src`: `app.ts` (middleware, rutas, manejador de errores), `config.ts` (**se lee en cada uso**: los tests lo modifican), `db.ts` + `migrations.ts`, `cache.ts`, `http.ts`, `providers/` (tmdb, mal, omdb), `content.ts` (búsqueda, tendencias, ficha), `library.ts` (paginación por cursor, `releaseGate`, `saveFullState`), `profile.ts` (estadísticas), `compare.ts` (comparar perfiles), `recommendations.ts`, `users.ts`, `listLife.ts` (inactividad y borrado), `mailer.ts`, `roadmap.ts`. Importación de MAL: `importTypes.ts` (contrato), `malXml.ts` (fichero de exportación), `malImport.ts` (vista previa con token, confirmación, cola de fichas) y `providers/mal.ts` → `fetchUserAnimeList`. Motores en segundo plano (nunca bloquean una petición): `news.ts` (novedades/notificaciones), `structure.ts` (temporadas nuevas o retiradas, películas retiradas), `runtimes.ts` (duración real de episodios). `domain/` (reglas puras sin red ni BD: `rules`, `time`, `ranking`, `recommend`, `release`, `seasons`, `structure`, `news`, `runtimes`, `malImport`), `routes/` (auth, account, library, discover, recommendations, notifications, friends, invites, profiles, lists, import).
 - `client/src`: `App.tsx` (rutas; pantallas poco usadas con `React.lazy`), `auth/`, `theme/`, `profile/` (contexto y envoltorio de `/perfil/:username`), `notifications/` (campana), `pwa/` (registro del SW y aviso de versión), `hooks/` (`useSwipeMenu`), `components/`, `pages/`, `roadmap/`, `config.ts` (`LIVE_SEARCH`), `api.ts` (`ApiError.data`, cancelación), `clipboard.ts`.
 - **BD**: SQLite con `sql.js` (en memoria, se vuelca a `data/mar.db` 300 ms tras escribir). **Un solo proceso por fichero**: dos servidores sobre la misma BD se pisarían. Migraciones numeradas (hoy 16): nunca editar una publicada, añadir otra. `db.export()` reinicia la conexión: se reactiva `PRAGMA foreign_keys` tras cada volcado.
 - Express 4: los handlers `async` van envueltos en `ah(...)`; los errores con `HttpError(status, mensaje)` (puede llevar `code`/`extra`); validación con zod vía `parse()`.
 - Los proveedores externos solo se llaman desde el servidor. Búsquedas: caché **en memoria** (`memCached`); fichas y OMDb: caché persistente (`cached`). `guarded()` corta un proveedor caído (1 min, duplicando hasta 15 min; se reinicia al responder) y la búsqueda espera como máximo `tmdbSoftMs` (6 s) / `malSoftMs` (3 s). Anime = API oficial de MyAnimeList v2 (`MAL_CLIENT_ID`, cabecera `X-MAL-CLIENT-ID`; rechaza búsquedas de < 3 caracteres); la API pública de Jikan cerró el 1/10/2026. Sin `MAL_CLIENT_ID` no se consulta.

## Reglas de negocio que no son obvias

 - Favorito (máx. 10) = Finalizado con todos los episodios; quitarlo solo lo saca de favoritos. Episodios: enteros; llegar o superar el total fija el máximo y finaliza. Película = 1 episodio. Horas = minutos de los episodios vistos con la duración real (series: media muestreada por temporada, ver `domain/runtimes.ts`); si falta el dato o `USE_REAL_RUNTIME=false`, la fija (serie 50, película 90, anime 23 min). Lo no estrenado solo admite «Por ver» (`domain/release.ts`, 409 desde `releaseGate`). Formato: horas → días → semanas → meses → años.
 - Perfil: `/perfil/<usuario>`, **solo amigos por defecto** o público; la lista solo si se permite; los amigos de alguien nunca son públicos. Todo el acceso se decide en `resolve()` (`routes/profiles.ts`).
 - Enlaces de amistad (`invite_links`): el propio añade como amigo a quien lo abre; el de otro perfil solo **envía una solicitud**. Cada enlace guarda quién lo generó y se puede renovar.
 - Listas conjuntas: una por pareja (`maxListsPerPair`), la crea cualquiera de los dos; salir no la borra (`left_at`); se borra tras 60 días sin actividad (ver no cuenta) con aviso en la app 15 días antes. El aviso por correo (12.10/12.12) está pendiente.
 - «Mi lista»: la flecha de la tarjeta avanza de fase en «Por ver» (→ Viendo) y «Viendo» (→ Finalizado) y en «Finalizado» hace **revisionado** (`POST /api/library/:id/rewatch`: vuelve a «Por ver» con episodios a 0 y se muestra «Reviendo»). Las estadísticas suman episodios actuales + `prev_episodes`; borrar un contenido (papelera o modo «Eliminar», `POST /api/library/delete`) o quitar episodios a mano los resta.
 - Tarjetas de **búsqueda/portada**: icono de lista = Por ver (izq., interruptor) · ojo = Viendo (centro, fondo verde) · ✔ = Finalizado (dcha., fondo morado, marca todos los episodios); los tres semitransparentes y con **iconos de línea** blancos y huecos (`components/Emoji.tsx`, Lucide; no usar emojis del sistema); no hay corazón. Las de «Mi lista» siguen con ♥ y flecha.
 - Importar de MyAnimeList (Ajustes › Mi perfil, `/api/import`): por nombre (solo listas públicas) o fichero de exportación; vista previa con token (un uso, 10 min) y confirmación que recalcula en una transacción. Watching/On-Hold → Viendo, Completed → Finalizado, Dropped → Dejado, Plan to Watch → Por ver; revisionados → `rewatch`/`prev_episodes`. Si ya existe gana lo más avanzado (veces terminado > episodios totales > estado; empate = MAR) y el favorito se conserva; no estrenado solo «Por ver»; sin favoritos ni notas; listas conjuntas intactas.
 - Ficha: el botón rojo «Eliminar» va al final de los estados y solo está activo si el contenido está en la lista (`DELETE /api/library/:id` con confirmación).
 - Menú: «Inicio» (nivel 0) → «Mi…» (una tabulación) → «Mis listas conjuntas» (otra más); «Ajustes» al nivel de «Inicio». La búsqueda es al escribir, **sin autocompletado** (retirado a petición).

## Roadmap y versiones

 - `roadmap/roadmap.json` es la fuente de verdad (fases > funcionalidades > tareas; estados `pendiente` | `en_progreso` | `hecho`); la página pública `/roadmap` lo lee y es solo lectura. Actualízalo al terminar cada tarea y al recibir cambios.
 - **Fechas**: cada tarea lleva `eta` (AAAA-MM-DD): la estimada mientras esté pendiente y la real al terminarla; si depende de algo externo, `eta: null` y `etaNote` con el motivo y el esfuerzo. Al crear tareas pon su fecha estimada y al cerrarlas actualiza `eta` a la fecha real. La página `/roadmap` las muestra por tarea, tarjeta y columna.
 - **Versiones (semver)**: cambio pequeño (arreglo, ajuste visual) = `x.y.Z`; funcionalidad nueva = `x.Y.0`; la major (`X.0.0`) solo cuando el autor lo diga. En cada publicación: `package.json`, `roadmap.json` (`release` y la fase) y CHANGELOG con su versión; el pie de la app la muestra. La versión actual está en `package.json`. Al cerrar una fase: CHANGELOG, DECISIONES si hay decisión nueva, README si cambia algo visible, y subir a GitHub.
 - Pendiente conocido: correo (12.10, 12.12), en espera por decisión del usuario. Hosting: Fly.io (`mar`), se opera con `tools/fly.exe` (ver `docs/DESPLIEGUE.md`).

## Pruebas

 - Todo cambio de servidor lleva test en `server/tests` (Vitest; `tests/client.ts` arranca la app con proveedores simulados de `mock-providers.ts` y BD en memoria). Los cambios de interfaz se comprueban en un navegador real: `puppeteer-core` + Edge headless contra `dev:mock`, con capturas, desde el directorio temporal de la sesión (no se añade al repo).
 - Las APIs reales se probaron a mano con las claves del `.env` (TMDB y OMDb); MyAnimeList, con el Client ID real el 2026-10-17 (búsqueda, ranking en emisión, ficha y películas).

## Trampas conocidas

 - PWA: `client/public/sw.js` lleva `__BUILD__`, que sustituye `vite.config.ts` al compilar; no lo quites. `/api` no debe pasar nunca por el service worker. En pruebas con `puppeteer-core` + Edge usa `headless: true` (`'new'` se cuelga) y rutas absolutas en `--screenshot`.
 - Tras cada cambio del cliente o del servidor: `npm run build` y, para publicar, despliegue en Fly (comando en `CLAUDE.local.md` / `docs/DESPLIEGUE.md`).

 - Comandos de shell largos con muchas comillas fallan ("unexpected EOF"): escribe el script en un fichero (Write/Edit) y ejecútalo. Cuidado con `\d`, `\/` en cadenas de TypeScript/JS.
 - Si `vite.config.ts` cambia con `npm run dev` en marcha, Vite se reinicia y pierde el proxy `/api`: reinicia `npm run dev`.
 - Cambios del cliente: `npm run share` y `npm start` sirven `client/dist`, hay que recompilar. Los del servidor se recargan solos con `ts-node-dev`.
 - `trust proxy` es `loopback` en local (para el túnel) y `1` en producción; la cookie de sesión es `Secure` solo si la petición llegó por HTTPS.
