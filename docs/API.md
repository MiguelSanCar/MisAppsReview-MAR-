# Referencia de la API

API JSON bajo `/api`. Todas las respuestas de error tienen la forma `{ "error": "mensaje en español" }` (y, a veces, `code` y datos extra). La entrada se valida con zod: los fallos devuelven `400` con el motivo.

- **Autenticación**: cookie `httpOnly` `mar_token` (JWT) que fijan `register` y `login`. «Sesión» en las tablas = requiere cookie válida (`401` si falta).
- **Formato de fechas**: ISO 8601 (UTC).
- **Paginación**: las listas largas usan cursor opaco (`nextCursor`); ver `GET /api/library`.

## Estado

| Método y ruta | Descripción |
|---|---|
| `GET /api/health` | `{ ok: true }` (fuera de producción añade `devSecret`) |
| `GET /api/search/status` | Qué proveedores están disponibles: `{ tmdb, omdb, mal }` (`mal` = hay `MAL_CLIENT_ID`) |

## Cuentas y sesión (`/api/auth`)

| Método y ruta | Cuerpo | Descripción |
|---|---|---|
| `POST /register` | `{ username, email, password, theme? }` | Crea la cuenta e inicia sesión. `username` 3–20 caracteres (`A-Za-z0-9_.-`), contraseña de 8 a 100. `theme` (`dark` \| `light`) opcional: tema que la persona ya usaba |
| `POST /login` | `{ identifier, password }` | `identifier` = usuario o correo |
| `POST /logout` | — | Cierra la sesión |
| `GET /me` | — | `{ user }` (o `null`): incluye `email`, `profilePublic`, `showList` y `theme` |
| `POST /forgot` · `POST /reset` | `{ email }` · `{ token, password }` | Recuperar contraseña (el enlace se escribe en el log del servidor mientras no haya SMTP) |
| `POST /verify/send` · `POST /verify` | — · `{ token }` | Verificar el correo |

## Mi cuenta (`/api/me`, sesión)

| Método y ruta | Descripción |
|---|---|
| `GET /profile` | Mi perfil: `user`, `stats` (`totalMinutes`, `watchTime`, `episodes`, `seasonsWatched`, `rewatches` (`contents`, `times`, `episodes`, `totalMinutes`, `watchTime`), `byStatus`, `finishedByType`) y `favorites` |
| `PUT /avatar` · `DELETE /avatar` | `{ dataUrl }` (imagen recortada) · quitar la foto. `GET /api/avatar/:id` la sirve |
| `PUT /visibility` | `{ isPublic, showList }` |
| `PUT /theme` | `{ theme: "dark" \| "light" }` — preferencia guardada en la cuenta |
| `PUT /notifications` | `{ favoritesOnly?, introSeen? }` — ajustes de la campana (solo favoritos; ventana inicial vista). Ambos viajan en `GET /api/auth/me` como `notifFavoritesOnly` y `notifIntroSeen` |
| `GET /export` | Copia de todos los datos de la cuenta |

## Búsqueda y contenido

| Método y ruta | Descripción |
|---|---|
| `GET /api/search?q=&type=` | Búsqueda unificada (TMDB + MyAnimeList; MyAnimeList solo con 3 caracteres o más). `q` ≥ 2 caracteres; `type` = `todo` \| `serie` \| `pelicula` \| `anime`. Devuelve `results`, `states` (estado de la persona en cada resultado), `warnings` y `tookMs`. Orden: primero lo que más coincide con el texto (exacto > empieza por > contiene la palabra > contiene el texto) y, a igualdad, lo más popular (popularidad de TMDB en escala logarítmica; en anime, miembros de MyAnimeList ÷ 3000) |
| `GET /api/search/trending?type=` | Lo más visto del momento |
| `GET /api/content/:id` | Ficha: datos, puntuaciones (IMDb, Rotten Tomatoes o MyAnimeList), `seasons` y el `state` de la persona |

Campos de estreno del contenido (en la ficha, los resultados y la lista):

| Campo | Descripción |
|---|---|
| `releaseDate` | AAAA-MM-DD: estreno de la película o primer episodio de la serie; `null` si no se conoce (anime incluido) |
| `unreleased` | `true` si `releaseDate` es futura: solo admite «Por ver» |
| `watchable` | Episodios ya marcables: `0` si no se ha estrenado, menos que el total si hay temporadas por estrenar, `null` = todos |
| `seasons[].air` | Fecha de estreno de la temporada |

Sin fecha no se bloquea nada.

### Búsqueda avanzada (`/api/discover`, sesión)

| Método y ruta | Descripción |
|---|---|
| `GET /` | Descubrir series o películas con filtros. Parámetros: `type` (`serie` \| `pelicula`), `sort` (`popularity` \| `rating` \| `date`), `page` (1–500), `genre`, `platform`, `studio` (ids de TMDB), `yearFrom`, `yearTo`, `minRating` (1–9). Devuelve `results`, `states`, `page`, `totalPages`, `hasMore`. Con nota mínima u orden por nota se exigen ≥ 150 votos |
| `GET /providers?type=` | Plataformas de streaming de la región (`TMDB_REGION`, `ES` por defecto) |
| `GET /genres?type=` | Géneros de TMDB en español, por orden alfabético |
| `GET /studios?q=` | Productoras cuyo nombre contiene el texto (2–60 caracteres) |

### Recomendaciones (`/api/recommendations`, sesión)

`GET /?type=serie|pelicula|anime&page=1..500` (scroll sin fin; TMDB no sirve más) — títulos de los géneros con más afinidad, sin repetir lo que ya está en la lista. Orden: por nota con preferencia por lo popular (60 % nota, 40 % popularidad); el encaje con los géneros solo decide qué candidatos entran y desempata.

```json
{
  "kind": "serie", "title": "Series que has podido ver", "reason": null,
  "items": [{ "id": 12, "title": "…", "why": "Drama", "…": "…" }],
  "genres": [{ "id": 18, "name": "Drama", "score": 2.31, "lift": 1.4, "userShare": 0.62, "marketShare": 0.5, "weight": 7.4 }],
  "page": 1, "hasMore": true, "states": {}, "warnings": []
}
```

`reason` explica un resultado vacío: `sin_datos` (nada en la lista), `anime` (sin géneros en MyAnimeList) o `sin_tmdb` (falta la clave).

## Mi lista (`/api/library`, sesión)

| Método y ruta | Cuerpo | Descripción |
|---|---|---|
| `GET /` | — | Lista paginada. Parámetros: `status`, `type`, `favorite=1`, `q`, `limit` (24 por defecto, máx. 60), `cursor`. Devuelve `{ items, nextCursor, total, counts }` (`counts` solo en el primer lote: `todos`, `favoritos` y uno por estado) |
| `PUT /:id/status` | `{ status }` | `POR_VER` \| `VIENDO` \| `FINALIZADO` \| `DEJADO` |
| `PUT /:id/favorite` | `{ value }` | Favorito (máximo 10) |
| `PUT /:id/later` | `{ value }` | Alterna «Por ver» |
| `PUT /:id/episodes` | `{ watched }` | Episodios vistos; llegar al total finaliza |

`PUT /:id/status`, `/:id/favorite` y `/:id/episodes` responden **409** si el contenido no se ha estrenado (`unreleased`) y se pide algo distinto de «Por ver», o si se marcan episodios de una temporada por estrenar (más de `watchable`). Un «Finalizado» en una serie con temporadas por estrenar llega solo hasta los episodios estrenados.
| `POST /:id/rewatch` | — | Volver a ver algo finalizado |
| `DELETE /:id` · `POST /delete` | — · `{ ids }` | Quitar de la lista (uno o hasta 500); resta sus episodios y minutos |

## Importar desde MyAnimeList (`/api/import`, sesión)

Importación puntual y repetible de la lista de anime de MyAnimeList a «Mi lista», en dos pasos: vista previa (no escribe nada) y confirmación con su token. Límite propio: 10 peticiones cada 15 minutos por persona (`IMPORT_RATE_LIMIT`; `429` al superarlo).

| Método y ruta | Cuerpo | Descripción |
|---|---|---|
| `POST /mal/preview` | `{ username }` | Lista **pública** de ese usuario de MAL (API con `MAL_CLIENT_ID`) → `ImportPreview` |
| `POST /mal/file` | fichero en bruto | Exportación de MAL (`myanimelist.net/panel.php?go=export`, `.xml` o `.xml.gz`; sirve para listas privadas) → `ImportPreview`. `Content-Type`: `application/octet-stream`, `application/gzip`, `application/xml` o `text/xml` (otro → `415`); máximo 2 MB (`413`) |
| `POST /mal/confirm` | `{ token }` | Aplica el plan → `ImportResult`. Token de un solo uso que caduca a los 10 minutos: `404` si no existe o es de otra persona, `410` si ya se usó o caducó |

Errores: `400` nombre o fichero no válido (no es una exportación de anime de MAL, está dañado, supera 20 MB descomprimido o 10 000 entradas) o lista vacía · `403` lista privada (usar el fichero) · `404` el usuario no existe en MAL · `503` falta `MAL_CLIENT_ID`.

`ImportPreview`:

```json
{
  "token": "…", "source": "usuario", "malUser": "nombre", "total": 312,
  "summary": { "add": 280, "update": 20, "same": 12, "adjusted": 3, "byType": { "tv": 250, "movie": 40, "ova": 22 } },
  "sample": [{ "title": "…", "outcome": "add", "status": "FINALIZADO", "watched": 24 }]
}
```

| Campo | Descripción |
|---|---|
| `source` | `usuario` (por nombre) \| `fichero` |
| `malUser` | Usuario de MAL o el que figura en el fichero; `null` si no se conoce |
| `total` | Entradas leídas |
| `summary.add` · `update` · `same` | Se añaden · se actualizan (lo de MAL está más avanzado) · sin cambios |
| `summary.adjusted` | Cambiadas por no estar estrenadas (solo entran como «Por ver») |
| `summary.byType` | Recuento por tipo de MAL (`tv`, `movie`, `ova`, `ona`, `special`, `music`, `tv_special`, `cm`, `pv`, `unknown`) |
| `sample` | Hasta 3 ejemplos de lo que se añade o actualiza (`outcome`: `add` \| `update` \| `same`) |

`ImportResult`: `{ added, updated, same, adjusted }`. Las entradas del fichero se guardan al confirmar y completan su póster y ficha en segundo plano. Reglas de la mezcla en [ARQUITECTURA.md](ARQUITECTURA.md#importación-desde-myanimelist).

## Perfiles (`/api/profiles`)

El acceso se decide en `resolve()`: `self`, `friend`, `public` o `private` (solo se ve que existe).

| Método y ruta | Descripción |
|---|---|
| `GET /:username` | Perfil con estadísticas, favoritas y los permisos (`access`, `canSeeList`, `canSeeFriends`). `403` con `code: "private"` si no es visible |
| `GET /:username/library` | Lista de la persona (mismos parámetros y formato que `/api/library`) |
| `GET /:username/friends` | Amigos (solo amigos) |
| `GET /:username/compare` | Sesión. Compara estadísticas con las de la persona (amiga o de perfil público): `rows` con valor propio y ajeno de cada métrica y quién gana (`me` \| `them` \| `tie`) y `summary` |
| `GET /by-id/:id` | Nombre de usuario de un id (redirecciones antiguas) |

## Amigos (`/api/friends`, `/api/invites`, sesión)

| Método y ruta | Descripción |
|---|---|
| `GET /api/friends` | Amigos y solicitudes enviadas y recibidas |
| `POST /api/friends/requests` | `{ username }` — enviar solicitud |
| `POST /api/friends/requests/:id/accept` · `DELETE /api/friends/requests/:id` | Aceptar o cancelar/rechazar |
| `DELETE /api/friends/:userId` | Eliminar una amistad |
| `POST /api/invites/mine` · `POST /api/invites/revoke` | Crear o renovar mi enlace de amistad / revocarlo |
| `POST /api/invites/request/:userId` | Enlace que, al abrirlo, envía una solicitud a esa persona |
| `GET /api/invites/:token` · `POST /api/invites/:token/accept` | Ver quién creó el enlace / aceptarlo |

## Listas conjuntas (`/api/lists`, sesión)

| Método y ruta | Descripción |
|---|---|
| `GET /` · `GET /with/:username` | Mis listas (y las que dejé) / la lista con un amigo |
| `POST /` | `{ friendId, name? }` — crear (una por pareja) |
| `GET /:id` · `DELETE /:id` | Detalle / borrar |
| `POST /:id/leave` · `POST /:id/join` | Salir sin borrarla / volver a unirse |
| `POST /:id/items` · `PUT /:id/items/:contentId` · `DELETE /:id/items/:contentId` | Añadir (`{ contentId }`), cambiar estado o episodios (el `PUT` responde 409 con las mismas reglas de estreno que «Mi lista»), quitar |
| `GET /:id/history` · `GET /:id/items/:contentId/history` · `POST /:id/items/:contentId/rollback` | Historial y rollback (`{ historyId }`) |

## Notificaciones (`/api/notifications`, sesión)

Novedades de los contenidos de la lista (temporadas anunciadas o disponibles; películas relacionadas de una serie o de la misma saga). **Estas rutas solo leen de la base de datos y vuelven al instante**: el cálculo, que consulta TMDB, se programa en segundo plano.

| Método y ruta | Descripción |
|---|---|
| `GET /` | `{ items, unseen, favoritesOnly, introSeen, checking }`. Cada item: `id`, `kind` (`season_announced` \| `season_released` \| `related_movie` \| `season_removed` \| `movie_removed`), `text`, `title` (contenido de la lista que lo origina), `createdAt`, `seen`, `contentId` (a dónde lleva: la película nueva si la hay) y `posterUrl`. Máximo 50, de más a menos reciente. Solo los contenidos que siguen en la lista (salvo `movie_removed`, que se muestra aunque la película ya se haya quitado) y, con `favoritesOnly`, solo los favoritos. `checking: true` indica que hay un cálculo en marcha y conviene volver a preguntar en unos segundos |
| `POST /seen` | Marca todo como visto (botón «Visto» del panel; abrir la campana ya no lo hace): `{ ok, marked }` |
| `DELETE /:id` | Elimina un aviso propio (botón «×» o arrastrarlo): queda visto y oculto, y no se vuelve a crear. 400 si el id no es válido, 404 si no existe, es ajeno o ya estaba eliminado |

## Roadmap (`/api/roadmap`, público)

| Método y ruta | Descripción |
|---|---|
| `GET /api/roadmap` | Contenido de `roadmap/roadmap.json` |
| `GET/POST/DELETE /api/roadmap/ideas` | Buzón de ideas: solo desde `localhost` (no en producción) |
