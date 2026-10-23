# Changelog

Versiones 0.x según el roadmap: fase N completada = versión 0.(N+1).0.

## 1.16.1 · 2026-10-23 · Notificaciones: «Visto», eliminar y arrastrar
### Añadido
- Panel de notificaciones: botón «Visto» arriba (con el número de pendientes) que marca todas como vistas; ya no se marcan solas al abrir la campana.
- Cada aviso tiene una «×» para eliminarlo y también se elimina arrastrándolo a derecha o izquierda; la tarjeta nunca sale visualmente del cuadro.
- `DELETE /api/notifications/:id`. Migración 16: `notifications.dismissed_at` (el aviso eliminado queda oculto y no se regenera).

## 1.16.0 · 2026-10-17 · Importar desde MyAnimeList
### Añadido
- **Importar la lista de anime de MyAnimeList** a «Mi lista» desde Ajustes › Mi perfil › «Importar de MyAnimeList», de dos formas: por **nombre de usuario** (solo listas públicas) o subiendo el **fichero de exportación** de MAL (`myanimelist.net/panel.php?go=export`, `.xml` o `.xml.gz`), que sirve también para listas privadas. Antes de escribir nada se muestra una vista previa con los recuentos (se añaden, se actualizan, sin cambios y ajustados por no estrenados) y unos ejemplos; la importación se confirma aparte. Es puntual y se puede repetir.
- Estados: Watching y On-Hold → Viendo; Completed → Finalizado; Dropped → Dejado; Plan to Watch → Por ver. Los revisionados de MAL pasan al contador de revisionados y a los episodios previos, y cuentan en las estadísticas.
- Si un anime ya estaba en MAR se queda lo más avanzado (veces terminado, luego episodios vistos en total, luego estado; en empate no se toca) y el favorito se conserva. Lo no estrenado solo entra como «Por ver». Se importan todos los tipos (TV, película, OVA, ONA, especial, música…) como anime. Las entradas del fichero completan su póster y su ficha en segundo plano.
- Endpoints `POST /api/import/mal/preview`, `POST /api/import/mal/file` y `POST /api/import/mal/confirm` (sesión; límite de 10 cada 15 minutos por persona, `IMPORT_RATE_LIMIT`).

### Sin cambios
- No se importan los favoritos (la API de listas de MAL no los da) ni las notas (MAR no tiene). Las listas conjuntas no se tocan.
- Limitación conocida: un anime guardado en MAR como serie de TMDB no se empareja con el de MAL y quedaría duplicado.

## 1.15.0 · 2026-10-17 · Anime desde la API oficial de MyAnimeList
### Cambiado
- **El anime pasa a la API oficial de MyAnimeList (v2)**. La API pública de Jikan cerró el 1 de octubre de 2026, y desde entonces no se podía buscar anime, la portada de anime salía vacía y las fichas sin caché fallaban. Requiere la variable `MAL_CLIENT_ID` (gratuita, https://myanimelist.net/apiconfig).
- Migración 15: el anime guardado cambia de fuente `jikan` a `mal`. Los ids son los mismos, así que fichas, progreso y listas siguen enlazados.
- `GET /api/search/status` devuelve `mal` en lugar de `jikan`.
- Las búsquedas de menos de 3 caracteres solo consultan TMDB, porque MyAnimeList no las admite.
- El anime con fecha de estreno futura solo admite «Por ver», como las series y películas.

### Retirado
- `JIKAN_ENABLED`, `JIKAN_BASE_URL`, `JIKAN_SOFT_MS`, `JIKAN_TIMEOUT_MS` y `JIKAN_MIN_GAP_MS`. Sus equivalentes son `MAL_CLIENT_ID`, `MAL_BASE_URL`, `MAL_SOFT_MS` (3 s), `MAL_TIMEOUT_MS` y `MAL_MIN_GAP_MS`.

## 1.14.1 · 2026-10-16 · Diagnóstico de Jikan en el servidor
### Corregido
- Las peticiones a los proveedores (TMDB, Jikan, OMDb) envían ahora un `User-Agent` (algunos servicios rechazan las peticiones sin él).

### Cambiado
- Cuando un proveedor falla o tarda demasiado en una búsqueda, el motivo queda en el registro del servidor (`fly logs`, líneas «[búsqueda]»).

## 1.14.0 · 2026-10-16 · Contenido sin estrenar y orden de resultados
### Añadido
- **Contenido sin estrenar**: lo que aún no ha salido (película con estreno futuro o serie cuyo primer episodio es futuro) solo admite «Por ver». Migración 14: `content.release_date`, que se rellena desde la búsqueda y el detalle de TMDB. En series, las temporadas por estrenar no dejan marcar episodios y un «Finalizado» manual llega solo hasta los episodios ya estrenados.
- `ContentDto` devuelve `releaseDate`, `unreleased` y `watchable`; las temporadas llevan `air`.
- Cuando una temporada por estrenar sale, quien tenía la serie Finalizada pasa a «Por ver» (como con una temporada nueva); el motor de novedades mantiene al día la fecha de estreno del contenido y las de sus temporadas.
- Cliente: en las tarjetas de búsqueda, ojo y ✔ quedan desactivados y oscuros; en «Mi lista», ♥ y flecha; en la ficha y en el modal de la lista conjunta, Viendo/Finalizado/Dejado y el contador, con aviso de estreno; las temporadas por estrenar salen oscuras, con su fecha y sin poder marcar episodios; el contador muestra «(N estrenados)».

### Cambiado
- `GET /api/search` (búsqueda del inicio): primero lo que más coincide con el nombre escrito (exacto, empieza por, contiene la palabra, contiene el texto) y, a igualdad, lo más popular. La búsqueda filtrada (`/api/discover`) no cambia.
- Recomendaciones de la portada: se ordenan por nota con preferencia por lo popular (60 % nota, 40 % popularidad); el encaje con los géneros solo filtra qué candidatos entran y desempata.
- `PUT /api/library/:id/{status,favorite,episodes}` y `PUT /api/lists/:id/items/:contentId` responden 409 si el cambio no es posible por falta de estreno.
- Sin cambios: el anime (Jikan) no tiene fecha de estreno y no se restringe; los estados guardados antes no se modifican.

## 1.13.2 · 2026-10-16 · Buscador compacto estable
### Corregido
- Portada: el buscador dudaba entre la versión básica y la compacta al bajar un poco o al volver arriba. El cambio alteraba la altura del contenedor, movía el contenido y volvía a disparar el cambio. Ahora el contenedor conserva su altura y los filtros solo se ocultan.

### Cambiado
- Esquinas de la barra compacta menos redondeadas.

## 1.13.1 · 2026-10-16 · Buscador compacto
### Cambiado
- Portada: al bajar, el buscador fijo pasa a una barra compacta (barra de bordes redondeados y fondo translúcido) con solo el cuadro de texto y el botón «Buscar»; los filtros Todo/Series/Películas/Anime se ocultan y reaparecen al volver arriba.

## 1.13.0 · 2026-10-16 · Estructura de temporadas sincronizada
### Añadido
- **Temporadas sincronizadas con TMDB** dentro del motor de novedades: si una serie gana una temporada ya estrenada (con episodios y fecha pasada), se actualizan `content.seasons` y `total_episodes` (ficha, perfil y comparaciones) y, para cada persona y cada lista conjunta que la tiene, lo Finalizado pasa a «Por ver» conservando los episodios vistos. «Viendo» y «Por ver» no cambian, «Dejado» se respeta y el favorito se conserva.
- Si TMDB retira una temporada, se restan solo sus episodios vistos y, si ya no falta ninguno, el contenido pasa a Finalizado. Aviso nuevo `season_removed` («Temporada N eliminada»).
- Película que TMDB ya no tiene (404): se quita de las listas y de las listas conjuntas (deja de contar en perfil y comparaciones) con el aviso `movie_removed`, que la campana muestra aunque ya no esté en la lista. El contenido sigue en la tabla `content`.
- Botón fijo «Volver arriba» en la portada y en la búsqueda filtrada.

### Cambiado
- El motor de novedades también refresca los contenidos que una persona solo tiene en una lista conjunta (sin generar avisos de novedades para ellos).
- Portada: el buscador queda fijo bajo la barra superior y, al cambiar el texto, se vuelve arriba del todo.
- `GET /api/notifications`: `kind` incluye `season_removed` y `movie_removed`.

## 1.12.3 · 2026-10-16 · Portada con scroll infinito
### Cambiado
- Portada: «Series/Películas que has podido ver» sigue cargando recomendaciones al llegar al final sin el tope de 5 páginas; solo se detiene cuando TMDB no devuelve más (límite de 500 páginas). `GET /api/recommendations` acepta `page` de 1 a 500.

## 1.12.2 · 2026-10-16 · Portada estable y scroll infinito
### Corregido
- Portada: «Series/Películas que has podido ver» ya no se recalcula al marcar contenidos; solo se actualiza al recargar la página (o al cambiar entre Series y Películas). Sustituye al recálculo diferido de la 1.11.1.
- Scroll infinito (portada, búsqueda filtrada y listas): al llegar al final tras el primer lote no se pedían más resultados. El indicador de «petición en curso» se liberaba después de pintar el lote, así que el observador, recreado al pintar, veía la petición como activa y no volvía a disparar. Ahora se libera antes de pintar y el observador se recrea al terminar la carga.

## 1.12.1 · 2026-10-15 · Revisión de redacción del roadmap
### Cambiado
- Roadmap: revisión de redacción de fases, funcionalidades y tareas con un tono profesional y neutro (sin dirigirse al autor), nota de fechas reformulada y emojis sustituidos por la descripción de los iconos.

## 1.12.0 · 2026-10-15 · Duración real de los episodios
### Añadido
- **Duración real de los episodios**: las horas vistas de las series suman la media de cada temporada en lugar de 50 min fijos. Se estima con una muestra de TMDB: los primeros N (4) episodios de cada temporada larga (más de 3N episodios) o, si las temporadas son cortas, N episodios cuya media vale para toda la serie.
- El cálculo va en segundo plano (concurrencia global 2, máximo 12 peticiones por serie, caché de 30 días) al abrir la ficha de una serie o ver un perfil con series sin calcular; nada espera a TMDB. Si falta el dato se usa la duración fija.
- Las revisiones también suman los minutos reales de los episodios revistos.

### Cambiado
- `USE_REAL_RUNTIME` pasa a `true` por defecto (`false` vuelve a 50 / 90 / 23 min). Las horas de los perfiles cambiarán en consecuencia.
- Nuevas variables opcionales `RUNTIME_SAMPLE`, `RUNTIME_MAX_FETCH` y `RUNTIME_CONCURRENCY`.

## 1.11.1 · 2026-10-14 · Recomendaciones al día
### Corregido
- Búsqueda inicial: «Series que has podido ver» (y películas) no cambiaba al añadir contenidos; ahora se recalcula unos segundos después del último cambio, sin parpadeo.

## 1.11.0 · 2026-10-14 · Revisiones
### Añadido
- Perfil: nueva estadística **Revisiones** con las veces que se ha vuelto a ver algo, los contenidos revistos, los episodios y las horas de las revisiones (sin contar el primer visionado). «Tiempo visto» y episodios siguen contando todos los visionados.
- Ficha: la nota de revisionado pasa a ser una tarjeta «Visionado n.º N» con el número de revisiones y los episodios de visionados anteriores.

## 1.10.0 · 2026-10-14 · Notificaciones de novedades
### Añadido
- **Campana de notificaciones** arriba a la derecha, a la izquierda del interruptor de tema. Avisa de novedades de los contenidos de la lista: temporadas anunciadas o ya disponibles y películas relacionadas (secuelas de una saga o spin-offs de una serie). Un clic lleva a la ficha del contenido y nada más.
- Con avisos sin ver la campana se pone en rojo y aparece un mensaje emergente («Tienes actualizaciones pendientes») durante unos segundos.
- Primera vez: ventana que oscurece la pantalla, explica el ajuste y pide elegir entre avisos de todos los contenidos o solo de los favoritos. El ajuste también está en Ajustes.
- Motor de novedades en segundo plano: la API solo lee de la base de datos y responde al instante; el cálculo contra TMDB va en cola con límite global de peticiones, rondas pequeñas, instantánea compartida entre personas y caducidades por tipo de contenido.
- Migración 13 (tabla `notifications` y columnas de apoyo) y rutas `GET /api/notifications`, `POST /api/notifications/seen`, `PUT /api/me/notifications`.
- 29 pruebas nuevas (reglas, motor, aislamiento de fallos y rendimiento).

### Notas
- Las películas relacionadas de una serie se detectan por título (heurística): puede haber algún falso positivo.

## 1.9.5 · 2026-10-14 · Horas vistas en el perfil
- **Horas vistas en el perfil (22.1):** bajo el tiempo visto (p. ej. «1,1 semanas») aparece ahora, en pequeño y con menos énfasis, el total en horas («180 horas vistas»; con un decimal por debajo de 10 h y con separador de miles en español). Se calcula en el cliente a partir de los minutos totales que ya devolvía la API.

## 1.9.4 · 2026-10-14 · Gesto del menú desde más lejos del borde
- **Gesto del menú desde más lejos del borde:** la zona donde puede empezar el deslizamiento para abrir el menú pasa del 35 % al **40 % del ancho** de la pantalla (156 px en un móvil de 390 px), y **ahora también funciona si el dedo empieza sobre un campo de texto sin foco** (p. ej. el buscador de inicio o el filtro de «Mi lista», que ocupan todo el ancho). Con el campo enfocado el gesto no actúa, porque se usa para seleccionar texto.
- Comprobado con toques reales en Edge: abre empezando al 5, 15, 30 y 38 % del ancho y no al 45 ni al 60 %; sobre un campo sin foco abre y con foco no; el resto de reglas (vertical, corto, lento, filas con scroll, diálogos, escritorio) sigue igual.

## 1.9.3 · 2026-10-14 · Búsqueda Filtrada y cierre de pendientes
- **Nombre de la pestaña:** la entrada del menú lateral y el título de la página pasan de «Búsqueda» a **«Búsqueda Filtrada»**, para distinguirla del buscador de la pantalla de inicio. La ruta (`/search`) no cambia.
- **Cierre de pendientes del roadmap:** probada la app instalada en **Android e iPhone** (17.19, funciona correctamente); el **APK queda descartado** (17.20; la PWA cubre ambos sistemas) y los filtros de la búsqueda se dan por suficientes (18.30). El envío de correo (12.10 y 12.12) sigue en espera.

## 1.9.2 · 2026-10-14 · Roadmap en orden inverso
- **Roadmap en orden inverso (21.1):** la página `/roadmap` muestra ahora **lo más reciente primero**: las columnas van de la última fase (la que se está haciendo) a la primera, las tarjetas de cada fase de la última a la primera y las tareas de cada tarjeta también, de modo que lo que está en marcha o pendiente se ve antes que lo ya hecho (en el móvil, donde las columnas pasan a vertical, la primera es la más reciente). Los filtros por estado y el refresco automático no cambian. Solo cambia la presentación: `roadmap.json` conserva su orden natural.
- Comprobado en Edge real: 22 fases de la «Fase 21» a la «Fase 0», tareas invertidas dentro de una tarjeta, filtros y móvil.

## 1.9.1 · 2026-10-14 · Documentación para GitHub
- **README profesional para GitHub (20.5):** reescrito en tercera persona (sin dirigirse al autor ni mencionar su entorno): qué es MAR, enlace a la demostración y a la hoja de ruta, **capturas** (móvil y escritorio, oscuro y claro), funcionalidades agrupadas, pila tecnológica, diagrama de arquitectura (Mermaid), puesta en marcha, configuración, scripts, pruebas, despliegue, estructura del repositorio, índice de documentación, versiones y limitaciones conocidas, créditos y atribuciones (incluida la de TMDB) y nota de licencia. La insignia de versión se lee de `package.json`.
- **Documentación complementaria (20.6):** `docs/ARQUITECTURA.md` (componentes, datos, proveedores y resiliencia, reglas de negocio, seguridad, cliente), `docs/API.md` (referencia de todos los endpoints con parámetros y ejemplos), `docs/DESARROLLO.md` (requisitos, scripts, pruebas, servidor simulado, convenciones, solución de problemas y trampas conocidas; recoge lo que antes estaba en el README) y `docs/historico/` para el encargo inicial y el borrador de roadmap. `.env.example` y `docs/DESPLIEGUE.md` incluyen `TMDB_REGION`.
- **Capturas reproducibles:** el servidor simulado tiene un **modo demo** (`MOCK_DEMO=1`): títulos conocidos con carátulas SVG generadas (sin imágenes con derechos) y los usuarios `demo` y `lucia`; `scripts/capturas.js` genera `docs/img/*.png`.
- Cierre de la fase 18 (18.31) con toda la documentación al día.

## 1.9.0 · 2026-10-14 · Temporadas vistas en el perfil
- **Temporadas vistas en el perfil (19.7):** nueva estadística **«Temporadas vistas»** en el perfil (propio y de otras personas) con el número de temporadas completas que ha visto la persona; en un revisionado no se cuentan dos veces; sin estructura, una serie o anime terminado cuenta como 1 y las películas, 0. También es una fila nueva de **«Comparar perfil»** (`seasons`) y viaja en `stats.seasonsWatched` de la API.
- Ver DECISIONES (Temporadas) para las reglas de cálculo.

## 1.8.0 · 2026-10-14 · Episodios por temporadas
- **Episodios por temporadas (19.4–19.6):** la ficha de una serie muestra secciones **«Temporada 1», «Temporada 2»…** con sus episodios debajo, como botones numerados. **Los botones + y − y el contador siguen igual**: los episodios se marcan por orden hasta el número de vistos, cada temporada indica su progreso (`5/7`, y `✓ 7/7` al completarla) y **pulsar un episodio fija el progreso hasta ahí** (pulsar el último visto lo desmarca). Se abre por defecto la temporada que toca ver; las demás se pliegan. Anime y series sin datos de temporadas tienen una sola sección «Episodios»; las películas, ninguna.
- **Datos:** migración 12 (`content.seasons`), tomada de TMDB sin los especiales; las series guardadas antes se completan al abrir su ficha. `normalizeSeasons` ajusta la suma al total de episodios (recorta o amplía la última temporada). API: la ficha (`GET /api/content/:id`) devuelve `seasons`.
- 14 tests nuevos (`server/tests/seasons.test.ts`): reglas puras, ficha, relleno de lo antiguo, progreso, perfil, revisionado, borrado, comparación y migración; y comprobación en Edge real (estructura, pulsar episodios, desmarcar, retroceder, terminar la serie, anime con 220 episodios, película sin temporadas).

## 1.7.0 · 2026-10-14 · Menú con gesto táctil
- **Gesto para abrir el menú (19.1):** en el móvil, **deslizar el dedo de izquierda a derecha** empezando en el tercio izquierdo de la pantalla **abre el menú lateral**, y **deslizar hacia la izquierda lo cierra** (también desde la zona oscura de la derecha). Hook `client/src/hooks/useSwipeMenu.ts`, activo solo cuando el menú es un cajón (< 900 px).
- **Sin interferencias (19.2):** el gesto se descarta si es sobre todo vertical (scroll), corto (< 70 px) o lento (> 0,9 s); no actúa sobre campos de texto, el recorte de foto ni con un diálogo abierto; y respeta las filas con scroll lateral: si el dedo empieza sobre una que puede desplazarse, el gesto es suyo; solo si ya está en su inicio y se desliza hacia la derecha (no puede ir a ningún sitio) se abre el menú. En pantallas anchas (menú fijo) no hace nada.
- **Sin «atrás» accidental:** la prueba con toques reales detectó que el navegador interpretaba el gesto como «volver a la página anterior» (ni `overscroll-behavior-x` ni `touch-action` lo evitaban). El hook cancela el movimiento horizontal que reconoce como suyo (`touchmove` no pasivo + `preventDefault`).
- Probado en Edge real con toques (`Input.dispatchTouchEvent`): 20 comprobaciones (abrir, cerrar, fuera de la zona, corto, vertical, lento, fila desplazada y en su inicio, diálogo, campo de texto, navegación y escritorio).

## 1.6.4 · 2026-10-14 · Mi lista y menú en el móvil
- **Menú lateral más alto (19.3):** en el móvil y en la app instalada, cada botón del menú (y los del pie: «Roadmap», «Cerrar sesión») mide **≥ 52 px**, para pulsarlos con facilidad.
- **Estados de «Mi lista» sin scroll lateral (19.8):** Todos, Por ver, Viendo, Finalizado, Dejado y Favoritos aparecen **siempre a la vista**; los que no caben pasan a la línea siguiente (en 390 px: dos líneas de tres).
- **Destello al cambiar de estado (19.9):** al pulsar la flecha de una tarjeta, el contador del estado de destino **se ilumina en verde unos 2 s** y su número sube al instante (el del estado de origen baja), para ver adónde ha ido la tarjeta. Los contadores se sincronizan después con el servidor.
- **Botones de las tarjetas (19.10):** la **papelera es roja** (translúcida) y el corazón y la flecha tienen **la misma transparencia y desenfoque que los botones de la búsqueda** (iconos blancos con sombra, legibles sobre cualquier carátula).
- Comprobado en Edge real (390 px, 300 contenidos): alturas del menú, 6 estados en 2 líneas sin scroll lateral, destello y números, y transparencias. Las pruebas detectaron dos errores de la propia prueba (cerrar el menú con un toque que caía sobre el menú; muestrear el color a mitad de la transición). Para poder avanzar de estado los contenidos sembrados de `dev:mock`, ahora se crean ya detallados.

## 1.6.3 · 2026-10-14 · Sugerencias que se cierran al perder el foco
- **Sugerencias que se cierran al perder el foco (20.9):** en el cuadro «Estudio o productora» de la búsqueda avanzada, la lista de sugerencias **desaparece en cuanto el cuadro deja de tener el foco** (clic fuera, paso a otro campo o tabulador fuera de la lista) y también con **Escape**, que cierra la lista sin borrar lo escrito (en un campo de búsqueda el navegador lo borraría). Vuelve a abrirse al poner de nuevo el foco o al seguir escribiendo. Con el teclado, el tabulador mueve el foco a la lista (se puede elegir sin ratón) y se cierra al salir de ella; elegir una sugerencia con el ratón o con el dedo sigue funcionando. Accesibilidad: el cuadro es un `combobox` con `aria-expanded` y `aria-controls`.
- Comprobado en Edge real: 13 comprobaciones (clic fuera, Escape, tabulador, otro campo, volver al cuadro, elegir sugerencia, sin errores de JavaScript).

## 1.6.2 · 2026-10-14 · Búsqueda: error de años sin interrumpir al escribir
- **Filtro de años de la búsqueda avanzada (20.8):** ya no salta el error mientras se escribe (antes aparecía al teclear la primera cifra de «Año desde»). Ahora no se avisa ni se busca con un año a medias; la búsqueda se lanza sola en cuanto el rango es coherente (cuatro cifras válidas o vacío, y el inicial no mayor que el final). El error aparece solo **al salir del campo** o al pulsar el nuevo botón **«Buscar»** (o Intro) con datos incoherentes, y desaparece al corregirlos. Se marca únicamente el campo que falla, y el aviso queda separado de los campos del formulario. «Buscar» con datos coherentes los aplica al momento y, en el móvil, pliega los filtros para ver los resultados.
- Comprobado en Edge real: 22 comprobaciones (escritura progresiva sin error ni petición, aviso al salir del campo, separación de 18 px, «Buscar» e Intro con rango incoherente sin llamar al servidor, corrección que limpia el error y busca, sin errores de JavaScript).

## 1.6.1 · 2026-10-14 · Portada: recomendaciones en vertical
- **Portada (20.2–20.4):** solo la fila de lo más visto («Series del momento», «Películas del momento» o «Anime del momento», según el filtro) tiene scroll lateral. **«Series que has podido ver» vuelve a ser una rejilla con scroll vertical** y, al llegar al final, **carga más recomendaciones** automáticamente (con «Cargar más» de reserva) hasta agotar los candidatos o llegar a 5 páginas. Cada página pide a TMDB la siguiente tanda de títulos de tus géneros con más afinidad y no repite lo mostrado ni lo que ya tienes; cambiar el filtro (Series / Películas) reinicia la rejilla.
- **API:** `GET /api/recommendations?type=…&page=1..5` devuelve además `page` y `hasMore`; una página fuera de rango es un 400.
- 2 tests nuevos de paginación y comprobación en Edge real (rejilla vertical de 2 columnas sin scroll lateral, 12 → 60 recomendaciones únicas en 5 cargas, filtros y sin errores).

## 1.6.0 · 2026-10-14 · Búsqueda avanzada
- **Búsqueda avanzada (18.25–18.29):** nueva entrada **«Búsqueda»** en el menú lateral, una tabulación más que «Inicio» y justo debajo (`/search`). Descubre **series y películas** con filtros combinables: **plataforma** (Netflix, HBO Max, Prime Video… según la región de TMDB, `ES` por defecto; configurable con `TMDB_REGION`), **género**, **estudio o productora** (con sugerencias al escribir), **años desde/hasta**, **puntuación mínima** y **orden** (más populares, mejor puntuadas, más recientes). Los filtros viven en la URL (se pueden compartir y funcionan con «atrás»), se pliegan en el móvil con un contador de filtros activos, no envían nunca un año inválido y cambiar entre series y películas reinicia plataforma y género (los catálogos difieren). Los resultados cargan al bajar (scroll infinito con «Cargar más» de reserva) y usan las mismas tarjetas con los botones de estado.
- **API:** `GET /api/discover` (`type`, `platform`, `genre`, `studio`, `yearFrom`, `yearTo`, `minRating`, `sort`, `page`; validado con zod, 400 con mensajes claros, 503 sin clave de TMDB) más `GET /api/discover/providers`, `/genres` y `/studios?q=` para rellenar los filtros (caché de 24 h, 30 días y 1 h). Ordenar por nota o filtrar por nota exige ≥ 150 votos para no llenar los resultados de títulos con un solo voto; ordenar por fecha excluye estrenos futuros. El anime de TMDB sigue sin mezclarse (lo cubre MyAnimeList, que no ofrece estos filtros).
- 11 tests nuevos (`server/tests/discover.test.ts`) con TMDB simulado y comprobación en Edge real (menú, filtros, URL, años, sugerencias de estudio, 25 resultados en 3 páginas sin duplicados, marcar estado, limpiar y escritorio). La prueba detectó un error real: al confirmarse un año se borraba lo que se escribía en el otro campo.
- **Pendiente (18.30):** el texto de la petición original llegó cortado tras «estud…»; si había más filtros previstos, cada uno añade unas 2 h.

## 1.5.0 · 2026-10-14 · Portada con recomendaciones
- **Portada con dos filas (18.22–18.24):** «Series del momento» (lo más visto de TMDB) en una **fila con scroll lateral** y, **inmediatamente debajo**, «Series que has podido ver»: las recomendaciones del punto anterior, con el motivo bajo cada tarjeta («Por tu gusto por Drama»). Las filas encajan cada tarjeta al deslizar (`scroll-snap`); con ratón aparecen flechas a los lados y se pueden recorrer con el teclado (`CardRow`). Los filtros Todo / Series / Películas / Anime cambian las dos filas («Películas del momento» / «Películas que has podido ver»; en Anime la segunda explica que aún no hay recomendaciones). Si aún no hay nada en la lista, la fila invita a marcar contenidos. Se puede marcar «Por ver», «Viendo» o «Finalizado» directamente desde una recomendación. «Siguiendo ahora» queda debajo.
- **Probado en Edge real** (móvil 390 px y escritorio 1200 px, oscuro y claro): dos filas adyacentes, scroll horizontal sin desbordar la página, exclusión de lo ya visto, filtros, estado vacío, marcar desde una recomendación y flechas en escritorio. La prueba detectó que con tarjetas de 128 px los tres botones de estado de 44 px se solapaban: las tarjetas de las filas miden ahora 154 px en móvil.

## 1.4.0 · 2026-10-14 · Recomendaciones por géneros
- **Recomendaciones (18.17–18.21):** nueva API `GET /api/recommendations?type=serie|pelicula` que sugiere títulos según los géneros con más afinidad. TMDB solo da «similares» de un título concreto, así que la afinidad se calcula aquí con tres ingredientes, como se pidió: la **presencia del género en el mercado** (cuota entre los ~60 títulos más populares de TMDB, cacheada 24 h), su **presencia en tu lista** y la **cantidad** de contenidos que tienes (cada uno suma 1; el favorito pesa el doble; por ver y dejado, menos). Fórmula: `log2(1 + lift) × log2(1 + peso)`, con suavizado para pocos datos (ver DECISIONES). Se piden a TMDB títulos de tus 3 géneros top (nota ≥ 6,5), se excluye lo que ya tienes y cada resultado indica el género que lo motiva; la respuesta incluye los géneros con sus números.
- **Géneros (migración 11):** `content.genres` se guarda al buscar y al abrir la ficha; lo ya guardado se completa poco a poco. Series y películas comparten gustos mediante una traducción de géneros equivalentes. Anime queda fuera (Jikan no da géneros).
- 18 tests nuevos (`server/tests/recommend.test.ts`): la fórmula (género raro vs. abundante, favoritos, pocos datos, mercado ausente, traducción de géneros, ranking) y el endpoint contra TMDB simulado (sin datos, exclusión de lo ya visto, caché, películas, relleno de géneros antiguos, anime, sin clave y permisos).

## 1.3.1 · 2026-10-14 · Corrección del tema claro
- **Corrección del tema claro (18.32):** en el tema claro quedaban degradados oscuros fijos (tarjeta «Tiempo visto» del perfil y cabeceras de columna del roadmap: se veían como una sombra), la etiqueta de estado y episodios de las tarjetas de «Mi lista» (fondo oscuro con texto oscuro) y la etiqueta «Frontend» del roadmap. Ahora usan variables por tema (`--stat-grad`, `--col-grad`, `--badge-bg`) y se ajustaron dos contrastes (`--danger`, `--doing`). Se añadió un **auditor automático** (Edge real, fuera del repo) que recorre 8 pantallas en los dos temas, en móvil (390 px) y escritorio (1200 px), y señala fondos o degradados oscuros que sobran en el claro, sombras fuertes y textos por debajo de WCAG AA: resultado limpio.

## 1.3.0 · 2026-10-14 · Tema claro y oscuro
- **Tema claro y oscuro (18.12–18.16):** el oscuro sigue siendo el predeterminado. **Interruptor arriba a la derecha de la cabecera** (también en las páginas públicas y en el roadmap) con una luna y un sol de contorno blanco y una bolita que marca el tema activo (`role="switch"`). La preferencia se guarda **por usuario** (migración 10: `users.theme`; `PUT /api/me/theme`; el campo `theme` viaja en `/api/auth/me`) y se aplica al iniciar sesión desde cualquier dispositivo; en **Ajustes → Apariencia** se puede elegir también «Oscuro (predeterminado)» o «Claro». Antes de iniciar sesión se recuerda en el navegador, y una cuenta nueva nace con el tema que el visitante ya usaba. Sin parpadeo al cargar (`public/theme-init.js`, script externo por la CSP) y la barra del navegador cambia de color (`theme-color`).
- **Paleta clara** con las mismas variables CSS (`:root[data-theme="light"]`); `--on-accent` sustituye al texto oscuro fijo sobre fondos de color. Comprobado en un Edge real: contraste WCAG AA (≥ 4,5, o 3 en texto grande) en 5 pantallas × 2 temas, flujo completo (interruptor, recarga, otro dispositivo, Ajustes, cuenta nueva) y capturas en móvil y escritorio.
- 7 tests nuevos (`server/tests/theme.test.ts`): valor por defecto, guardado y recuperación desde otra sesión, aislamiento entre cuentas, validación, registro con tema y la migración sobre cuentas existentes.

## 1.2.0 · 2026-10-14 · Comparar perfiles
- **Comparar perfiles (18.8–18.11):** dentro del perfil de otra persona (amigo o público) el menú lateral ofrece **«Comparar perfil»** (`/perfil/<usuario>/comparar`). La pantalla pone a «Tú» a la izquierda y a la otra persona a la derecha, con 10 estadísticas por fila (tiempo visto, episodios, terminadas en total y por tipo, viendo, por ver, dejadas y favoritas): **verde con ▲ para quien tiene más y rojo con ▼ para quien tiene menos**; en empate, gris. La señal no depende solo del color (triángulo dibujado en CSS y texto «más / menos / igual» para lectores de pantalla). API: `GET /api/profiles/:usuario/compare` (requiere sesión; mismas reglas de acceso que ver el perfil: privado → 403, uno mismo → 400, no expone correo ni datos privados). La lógica de comparación es una función pura (`server/src/compare.ts`). Sin sesión, la pantalla pide iniciar sesión.
- 6 tests nuevos (`server/tests/compare.test.ts`) y comprobación en navegador (menú, colores calculados, 390 px sin desbordes, sin sesión). El servidor simulado (`dev:mock`) no recarga solo: hay que reiniciarlo tras cambios del servidor.

## 1.1.0 · 2026-10-14 · Lista infinita
- **Lista infinita (18.2–18.7):** «Mi lista» y la lista de otros perfiles cargan **24 contenidos** y añaden 24 más al acercarse al final (con «Cargar más» como reserva). `GET /api/library` y `GET /api/profiles/:usuario/library` devuelven `{ items, nextCursor, total }` (+ `counts` en el primer lote); admiten `limit` (24 por defecto, máximo 60), `cursor`, `status`, `type`, `favorite` y `q`; los permisos del perfil no cambian. El **cursor** es de teclado (fecha + id), no un desplazamiento: editar una tarjeta mientras se cargan más no duplica ni salta nada. Los contadores de las pestañas son los reales (300) aunque solo haya 24 tarjetas; el filtro por título y el de tipo se hacen en el servidor y reinician la lista; la pestaña pulsada se centra en la tira desplazable.
- **Rendimiento medido** en Edge con un móvil emulado (390×780, CPU 4× más lenta) y 300 contenidos (`MOCK_SEED=300 npm run dev:mock -w server` crea el usuario «carga» / `Prueba-12345`): 13 peticiones de 24, sin duplicados, 7 MB de memoria JS, 22 ms por fotograma al desplazarse con las 300 cargadas. Dos medidas lo consiguen: `content-visibility: auto` en las tarjetas y `React.memo` (script 8,7 s → 0,7 s; maquetación 3,3 s → 0,7 s). Ver DECISIONES.
- 6 tests nuevos (`server/tests/library-page.test.ts`): lotes, orden, total, contadores, filtros, edición a mitad de la carga, validación del cursor y permisos del perfil.

## 1.0.1 · 2026-10-14 · Icono de la pestaña
- **Icono de la pestaña (18.1):** `favicon.svg` pasa a ser la «M» de Lock Block sola, más grande y sin ficha (se lee en pestañas claras y oscuras), y `favicon.ico` se regenera. Los enlaces llevan `?v=2` para que el navegador abandone el icono antiguo que tuviera en caché. Los iconos de la app instalada (PWA) conservan la ficha azul.

## 1.0.0 · 2026-10-14 · Fase 17 · Versión móvil (PWA)
Primera versión estable: MAR se instala en Android e iPhone como PWA, con logotipo y favicon propios. Pendiente de ti (fuera de la 1.0): probar en móviles reales (17.19) y, si quieres, el APK (17.20).

- **Identidad visual (17.1–17.4):** logotipo propio «MAR» en SVG (`client/src/components/Logo.tsx`): letras de bloque gruesas y geométricas dibujadas desde cero sobre una cuadrícula de 40×50, inspiradas en el estilo de Lock Block pero sin copiar sus glifos (esa fuente es solo de uso personal). Es un trazado, no texto: no depende de ninguna fuente, hereda el color (`currentColor`) y lleva `aria-label="MAR"`. Sustituye al texto «MAR» en la cabecera de la app y en la de las páginas públicas.
- **Favicon:** `favicon.svg` (monograma «M» blanco sobre ficha azul, legible a 16 px) y `favicon.ico` con 16 y 32 px, enlazados en `index.html`.
- **App instalable (17.5–17.8):** iconos PNG generados desde el logotipo (`client/public/icons/`: 192 y 512 «any», 512 «maskable» con la M dentro de la zona segura y `apple-touch-icon` de 180, opaco); `manifest.webmanifest` (`standalone`, `lang: es`, colores `#0b0f1a`); `index.html` con enlace al manifiesto, `theme-color`, metaetiquetas de iOS (barra de estado opaca) y `viewport-fit=cover`. La CSP de `helmet` no necesita cambios (manifiesto e iconos caen en `'self'`). Test `server/tests/pwa.test.ts`: valida el manifiesto, el tamaño real de los PNG, el enlace en `index.html` y, con el cliente compilado, el tipo MIME `application/manifest+json`, los iconos y la CSP.
- **Service worker (17.9–17.12):** `client/public/sw.js` (a mano, sin dependencias: compatible con Node 16). Reglas: **`/api` nunca se intercepta ni se cachea** (datos personales y en vivo); las navegaciones van a la red y, si falla, muestran `offline.html`; los ficheros con hash de `/assets` se sirven primero de la caché (máximo 80); se precachean `offline.html`, el favicon y un icono. Las **carátulas de TMDB/MyAnimeList se dejan a la caché HTTP del navegador**: el service worker no puede pedirlas (la CSP `connect-src 'self'` lo impide) y una respuesta opaca ocuparía muchísimo en la cuota del navegador.
- **Sin conexión:** `offline.html` autocontenida (sin JavaScript, por la CSP) con el botón «Reintentar».
- **Versión nueva:** `vite.config.ts` sustituye `__BUILD__` por `versión-marcadeTiempo` en `dist/sw.js`, de modo que cada despliegue cambia el fichero. El cliente (`client/src/pwa/`) detecta el worker nuevo en espera, también al volver a abrir la app, y muestra «Hay una versión nueva · Actualizar»; al pulsar se activa y se recarga (solo entonces). Se borran las cachés de versiones antiguas.
- **Cabeceras de caché del servidor:** `/assets/*` → `immutable` (1 año); `index.html`, `sw.js`, `offline.html`, `manifest.webmanifest` y las rutas de la SPA → `no-cache`; el resto → 1 día.
- **Pruebas:** 11 tests nuevos en `server/tests/pwa.test.ts` (el service worker se ejecuta en un contexto simulado: no toca `/api`, muestra la página offline sin red, solo se activa a petición, limpia cachés antiguas; y las cabeceras reales). Además se probó en Edge real (`puppeteer-core`, fuera del repo): registro y control de la página, `/api` fuera de caché, página sin conexión, aviso de actualización y recarga. Esa prueba detectó un fallo real: el registro se hacía con el evento `load`, que ya había pasado cuando React ejecutaba el efecto; ahora se registra al momento si la página ya cargó.
- **Diseño móvil (17.13–17.17):** auditoría con Edge real (`puppeteer-core`, fuera del repo) en 390×780 de landing, acceso, registro, roadmap, inicio, Mi lista, amigos, listas, ajustes, perfil, ficha y menú; sin desbordes horizontales. Cambios: **zonas seguras** (`env(safe-area-inset-*)` en cabecera, contenido, menú lateral, pie y avisos), **altura dinámica** (`100dvh`; «Amigos» y «Listas» ya no tienen scroll de más), **objetivos táctiles de 44 px** (botones, pestañas, chips, iconos, botones de las tarjetas, papelera) solo con puntero táctil, **16 px en los campos** (evita el zoom de iOS), `touch-action: manipulation`, pestañas de «Mi lista» en una fila desplazable y etiqueta de la tarjeta que ya no se solapa con la papelera. El menú lateral se mantiene (ver DECISIONES). Sin dependencias del ratón: el temblor del modo «Eliminar» es una animación, y el historial ya mostraba sus botones en pantallas sin hover.
- **Rendimiento (17.17):** carga diferida de roadmap, ajustes, amigos, listas, perfiles públicos, invitaciones y lista compartida (`React.lazy`); el paquete inicial pasa de 248 a 217 kB (76,9 → 69,5 kB comprimido).
- **Pruebas automáticas (17.18):** `server/tests/pwa.test.ts` (manifiesto, iconos, service worker y cabeceras; 15 tests). Auditoría **Lighthouse 9** móvil de la pantalla de acceso (funciona con Node 16, fuera del repo): rendimiento 95, accesibilidad 100, buenas prácticas 100, PWA 100 y SEO 92 (faltaba un `robots.txt` válido: añadido, permite todo salvo `/api/`).
- **Roadmap con el logotipo (17.21):** arriba a la izquierda de `/roadmap`, el logotipo completo en lugar del texto «← MAR»; sigue llevando a la página de inicio.
- **Acceso sin scroll (17.22):** inicio, entrar, registro, «olvidé mi contraseña», restablecer y verificar ocupan justo la altura de la ventana en móvil (`100dvh`, contenido centrado, cabecera y pie compactos, atribución de TMDB incluida). Comprobado en 8 tamaños (320×568, 360×560, 360×640, 375×550, 375×667, 390×664, 390×780, 412×915) × 4 pantallas: ninguna tiene scroll. Solo si la ventana es diminuta aparece un desplazamiento interno para no ocultar contenido; en ≤ 400 px de ancho se oculta el enlace «Roadmap» de esa cabecera y en ≤ 600 px de alto, la versión del pie.
- **Logotipo con la letra de Lock Block (17.23–17.25):** el trazado propio se sustituye por los **glifos M, A y R reales de Lock Block** (Sronstudio), extraídos de la fuente con `opentype.js` y convertidos a SVG (`Logo.tsx`). La «M» del favicon, de `favicon.ico` y de los iconos de la PWA (192, 512, maskable y `apple-touch-icon`) es la M de esa fuente. **Licencia:** la descarga de dafont es una demo de **uso personal**; MAR es personal y gratuita, pero si algún día tuviera uso comercial habría que comprarla o cambiar el logotipo (el diseño propio anterior sigue en el historial de git). El fichero de la fuente no se sube al repo. Detalle en `docs/THIRD_PARTY_LICENSES.md`.

## Despliegue · 2026-10-14 · Fly.io
- **App publicada en https://mar.fly.dev (5.1, 5.3, 5.8):** Fly.io, región París (`cdg`; Madrid ya no existe), una máquina `shared-cpu-1x` de 512 MB siempre encendida y volumen cifrado de 1 GB en `/data` con copias diarias. Configuración en `fly.toml`.
- Secretos en Fly (`JWT_SECRET` nuevo y distinto del local, `PUBLIC_URL`, `CLIENT_ORIGIN`, claves de TMDB y OMDb). La BD de producción empieza vacía.
- `flyctl` portable en `tools/fly.exe` (sin administrador). Pasos y trampas en `docs/DESPLIEGUE.md`.
- Correo (12.10, 12.12): en espera por decisión del usuario.

## 0.17.0 · 2026-10-13 · Fase 16 · Ficha y botones
- **Botón «Eliminar» en la ficha (16.1–16.3):** al final de la fila de estados (Por ver · Viendo · Finalizado · Dejado · **Eliminar**). Solo se activa cuando el contenido está en tu lista, en cualquiera de los estados; si no, aparece desactivado con la ayuda «Solo disponible cuando lo tienes en tu lista». Pide confirmación con el texto según el tipo («¿Estás seguro de borrar permanentemente esta película de tu lista?») y, al confirmar, se restan sus episodios y minutos del perfil y los estados quedan sin marcar.
- **Botones de la búsqueda (16.4–16.6):** el icono de lista ya no tiene lápiz (portapapeles con lista), la marca ✔ queda centrada (medido: desvío < 0,2 px) y los tres botones son **semitransparentes** (opacidad ≈ 0,5–0,6), dejando ver la carátula; el activo se refuerza con un aro blanco y más color.
- **Iconos de línea (16.7–16.9):** los «emojis» de la interfaz (botones de la búsqueda, menú, aviso de revisionado y fechas del roadmap) pasan a ser **iconos de contorno blanco y transparentes por dentro** con **Lucide** (`lucide-react` 0.469.0, licencia ISC; solo se incluyen los 8 necesarios). Se probó antes Twemoji (SVG de color) pero se descartó por ser figuras rellenas. Componente: `client/src/components/Emoji.tsx`. Licencia en `docs/THIRD_PARTY_LICENSES.md`.

## 0.16.0 · 2026-10-13 · Fase 15 · Botones de la búsqueda
- Las tarjetas de la búsqueda (y las de la portada con las tendencias) cambian sus botones por **tres botones de estado**: **lista** a la izquierda (añadir a «Por ver»; vuelve a pulsarlo para quitarlo), **ojo** en el centro con fondo **verde** («Viendo») y **marca ✔** a la derecha con fondo **morado** («Finalizado»: marca todos los episodios como vistos). El emoji de la marca de verificación va sin fondo propio (en blanco sobre el morado). El estado activo se señala con un aro blanco y `aria-pressed`.
- **El corazón sale de la búsqueda.** Sigue disponible en la ficha del contenido y en las tarjetas de «Mi lista», que conservan ♥ y la flecha de avanzar de fase / volver a ver.
- Solo cliente; sin cambios en la API (usa `/status` y `/later`).

## 0.15.0 · 2026-10-13 · Fase 14 · Menú, búsqueda y gestión de la lista
- **Roadmap con fechas (14.16, 14.17) — prioridad alta:** cada tarea, cada tarjeta y cada columna indican cuándo estará lista: **«Hecho el 13 oct»** (fecha real), **«Listo hoy»** / **«Listo ~ 15 oct»** (estimada), **«Retrasado (previsto …)»** si se pasa, y **«Sin fecha»** cuando depende de algo externo (con el motivo y el esfuerzo estimado al pasar el ratón o debajo). La fecha de una tarjeta o columna es la de su última tarea pendiente (o la de la última terminada si está todo hecho). Datos: campos `eta` y `etaNote` de cada tarea en `roadmap.json`.
- **Búsqueda (14.1, 14.2):** se **retira el autocompletado** (desplegable de sugerencias, su ruta `/api/search/suggest` y sus tests); los contenidos siguen apareciendo mientras se escribe. Tras el año y la categoría se muestra la **plataforma de origen** (TMDB, MyAnimeList). Nota: IMDb y Rotten Tomatoes son solo las puntuaciones de la ficha; los datos de series y películas vienen de TMDB.
- **Menú (14.3–14.6):** jerarquía con «Inicio» arriba; las entradas «Mi…» una tabulación a la derecha como subsección; «Mis listas conjuntas» justo debajo de «Mi lista» y otra tabulación más; «Ajustes» al nivel de «Inicio». Se mantienen los iconos de la casa y el engranaje y se añaden 📝 Mi lista, 🗂️ Mis listas conjuntas y 👥 Mis amigos. Desaparece la fila inferior «Inicio / Ajustes».
- **Revisionado (14.7–14.9):** la flecha de las tarjetas «Finalizado» las devuelve a «Por ver» con los episodios a 0 (`POST /api/library/:id/rewatch`). Se muestran como **«Reviendo»** (tarjeta y ficha, con nota del n.º de visionado). Los episodios del visionado terminado se guardan aparte (`prev_episodes`, migración 9) y **siguen contando** en episodios, minutos y «Terminadas» del perfil; si se vuelve a finalizar, cuentan dos veces.
- **Borrar contenidos de «Mi lista» (14.10–14.15):** papelera arriba a la derecha de cada tarjeta con confirmación («¿Estás seguro de borrar permanentemente esta serie de tu lista?», según sea serie, película o anime). Botón rojo **«Eliminar»** a la derecha de los filtros: las tarjetas tiemblan (se respeta «reducir movimiento»), desaparecen favorito, flecha y papelera, un clic las selecciona y **«Confirmar borrado»** abre una segunda confirmación. Borrado en bloque en una sola operación (`POST /api/library/delete`). Borrar un contenido resta sus episodios y minutos (también los de visionados anteriores); quitar episodios a mano también resta.
- Quitar «ver más adelante» durante un revisionado ya no borra la fila (se perderían los visionados anteriores).
- 146 tests (nuevos: revisionado, estadísticas, borrado individual y en bloque) y prueba end-to-end en navegador de todo lo anterior.

## 0.14.0 · 2026-10-13 · Fase 13 · Búsqueda robusta
Motivo: aparecían los avisos «TMDB está tardando» y «MyAnimeList (Jikan) está tardando». Se midió en la red corporativa: Jikan no responde nunca (bloqueado) y el límite único de 3,5 s también cortaba a TMDB, que en una conexión fría a través del proxy puede tardar más. Además cada búsqueda con «Todo» esperaba 3,5 s mientras no actuaba el corte.
- **13.1** Límite de espera por fuente: TMDB 6 s (`TMDB_SOFT_MS`), Jikan 2 s (`JIKAN_SOFT_MS`); sustituye al único `SEARCH_SOFT_MS`.
- **13.2** El corte automático ahora tiene **retroceso progresivo**: 1 min tras el primer fallo, el doble con cada fallo seguido hasta 15 min (`PROVIDER_DOWN_MS`, `PROVIDER_DOWN_MAX_MS`), y se reinicia en cuanto la fuente responde. Antes se volvía a probar (y a esperar) cada minuto. Medido: de 3,5 s por búsqueda a ~150 ms tras las 2 primeras.
- **13.3** `JIKAN_ENABLED=false` desactiva Jikan por completo: «Todo» no espera ni avisa; en «Anime» y en la portada de anime se indica que está desactivado; `/api/search/status` lo refleja.
- **13.4** Avisos más claros: «tarda más de lo normal» (la respuesta llegará en la siguiente búsqueda) y «no responde ahora mismo (¿red bloqueada?); se omite un rato y se volverá a probar solo».
- 133 tests (nuevos: corte progresivo, tope, reinicio, errores de API que no cortan, interruptor de Jikan).

## 0.13.0 · 2026-10-13 · Fase 12 · Vuestra lista
- **«Vuestra lista» (12.1–12.3):** nueva entrada en el menú del perfil de un amigo. Si la pareja ya tiene lista conjunta, se abre directamente; si no, pantalla «Aún no tenéis una lista conjunta» / «Crea una lista conjunta e invita a tu amigo» con el botón **«Crear nueva lista conjunta»**, que la crea al instante (nombre por defecto «Lista de X y Y») y la otra persona la ve sin aceptar nada.
- **Listas por pareja (12.4–12.6):** una lista por pareja por ahora (`maxListsPerPair`, el modelo admite varias); la pareja se guarda aparte de los miembros. Cada persona puede **salir** de la lista sin borrarla (`left_at`), verla en «Listas que has dejado» y **volver a unirse** mientras sigan siendo amigas. Si salen las dos, la lista se conserva.
- **Inactividad (12.7, 12.8, 12.11):** se registra la última actividad (crear, añadir, quitar, estado, episodios, rollback, unirse, salir; ver no cuenta). Tras **2 meses** sin actividad la lista se borra con todo su contenido e historial (tarea al arrancar y cada 6 h, `server/src/listLife.ts`). Los 15 días previos se avisa **dentro de la app** (banner en la lista e insignia «Se borrará en N días»). Plazos configurables: `JOINT_INACTIVITY_DAYS`, `JOINT_WARNING_DAYS`.
- **Base del SMTP (12.9):** `server/src/mailer.ts` (nodemailer) con configuración `SMTP_*` / `MAIL_FROM`, validación del destinatario y protección contra inyección de cabeceras; sin SMTP escribe el correo en la consola. **No se usa todavía** (prioridad baja): recuperar contraseña y verificar correo siguen mostrando el enlace en consola. Comando de comprobación: `npm run mail:test -w server -- tu@correo.com`.
- Pendiente (prioridad baja): aviso por correo antes del borrado (12.10) y conectar el envío real (12.12).
- Migración 8 con relleno de las listas existentes (pareja y última actividad). 124 tests en total.

## 0.12.0 · 2026-10-13 · Fase 11 · Perfiles con URL propia
- **URL única por perfil (11.1–11.4):** `/perfil/<usuario>` (con subpáginas `/lista` y `/amigos`) sustituye a `/friend/<número>`. Botón «Copiar URL del perfil». Las direcciones antiguas (`/friend/<id>[/list|/friends]`, `/profile`, `/u/<token>`) redirigen.
- **Visibilidad (11.5–11.8):** cada perfil es **solo para amigos (por defecto)** o **público** (cualquiera, también sin cuenta, solo lectura); opción de mostrar la lista en el perfil público (los amigos de una persona nunca son públicos). Un perfil privado visto por otra persona muestra un aviso y permite **enviar solicitud** (o iniciar sesión / registrarse si no hay sesión). Se muestra la visibilidad en el perfil propio.
- API nueva `/api/profiles/<usuario>[/library|/friends]` (sustituye a `/api/users/:id/*`) y `PUT /api/me/visibility`; el antiguo enlace con token pasó a ser solo una redirección. El enlace de solicitud (nombre en el menú) también sirve para perfiles públicos.
- Migración 7: quien ya compartía su perfil pasa a público.

## 0.11.0 · 2026-10-13 · Fase 10 · Menú y listas
- **Menú (10.1, 10.2):** «Inicio» pasa a la parte baja, en la misma fila que «Ajustes» y diferenciado del resto de entradas; «Listas conjuntas» pasa a **«Mis listas conjuntas»** (menú y títulos).
- **Tarjetas de «Mi lista» (10.3, 10.4):** la flecha (abajo a la derecha) **pasa el contenido a la siguiente fase** (Por ver → Viendo → Finalizado; al finalizar se marcan todos los episodios) y solo aparece en las pestañas «Por ver» y «Viendo». En «Todos», «Favoritos», «Finalizado» y «Dejado» no se muestra. En la búsqueda sigue siendo «ver más adelante».

## 0.10.0 · 2026-10-13 · Fase 9 · Mejoras
- **Foto de perfil desde el menú (9.1):** al pulsar la imagen del menú lateral se abre una ventana con la foto actual y opción de actualizarla (recorte circular) o quitarla. En el perfil de un amigo solo se ve.
- **Enlaces de amistad (9.2–9.5):** al pulsar tu nombre en el menú se copia un enlace (`/invite/<token>`); quien lo abra con su cuenta te añade como amigo directamente. Desde el perfil de un amigo, el mismo gesto copia un enlace que **envía una solicitud** a esa persona (no la añade). Sin sesión se muestra una pantalla que exige iniciar sesión o registrarse y, tras hacerlo, se vuelve al enlace (`?next=`). Cada enlace queda guardado con quién lo generó (tabla `invite_links`) y se puede renovar en Ajustes. Si el navegador no permite el portapapeles (p. ej. `http://IP`), se usa una alternativa.
- **Búsqueda al escribir (9.6, 9.9):** resultados mientras se escribe (espera de 300 ms, cancelando las peticiones anteriores). Muestra el tiempo del servidor y el total para evaluar la velocidad. Interruptor `LIVE_SEARCH` en `client/src/config.ts` para volver a buscar solo con Enter.
- **Sugerencias (9.7):** lista desplegable con teclado (↑ ↓ Enter Esc) y la parte escrita resaltada.
- **Pantalla inicial (9.8):** series más vistas del momento (TMDB, tendencia semanal); según el filtro, películas o anime (Jikan). Sin clave de TMDB cae en anime.
- **Rendimiento:** caché en memoria para las búsquedas (sin escribir en la BD en cada pulsación) con peticiones simultáneas compartidas; no se vuelven a guardar contenidos ya completos; un proveedor lento no retrasa más de 3,5 s la respuesta (se avisa y se completa en la siguiente).
- **Pulido (9.10):** separación del aviso de «Sus amigos» respecto a la lista.
- 98 tests (nuevos: sugerencias, tendencias, límite de espera, enlaces de amistad) y prueba end-to-end en navegador de todo el flujo.
- Roadmap: planificados los perfiles con URL propia y «Vuestra lista» (tras añadir la fase 10 quedaron como fases 11 y 12).

## 0.9.0 · 2026-10-13 · Fases 1 a 8
### Fase 1 · Cuentas (0.2.0)
- Base de datos SQLite con `sql.js` (WASM, sin compilar nada nativo), migraciones versionadas en `server/src/migrations.ts` y volcado a `data/mar.db`.
- Registro, login y logout (bcryptjs + JWT en cookie httpOnly, sameSite). Validación con zod en el servidor. Login por usuario o correo; mensaje genérico ante error para no revelar cuentas.
- Seguridad básica: helmet (CSP incluida), límite de intentos en auth, CORS restringido, `.gitignore` de `.env` y BD.
- Pantalla inicial pública con "Iniciar sesión" y "Registrarse" arriba a la derecha; contraseña ofuscada con botón Ver/Ocultar.
- Layout con menú lateral (avatar redondo + nombre + Inicio, Mi perfil, Mi lista, Mis amigos, Listas conjuntas, Ajustes): abierto por defecto en escritorio, cajón en móvil.

### Fase 2 · Búsqueda (0.3.0)
- Proveedores TMDB (series y películas), Jikan (anime, con límite de ~3 peticiones/s) y OMDb, todos desde el servidor, con **caché persistente** en BD y reutilización de datos caducados si el proveedor falla.
- Buscador único con filtro por tipo; resultados entrelazados; las series de animación japonesa de TMDB se descartan (las cubre Jikan).
- Tarjetas con ♥ (favorito → pasa a Finalizado con todos los episodios; máximo 10, error claro al 11º) y ↪ (ver más adelante, alterna).
- Avisos si falta una clave o un proveedor falla; la app arranca sin claves. Atribución a TMDB en el pie.

### Fase 3 · Contenido (0.4.0)
- Ficha: sinopsis, episodios, estudio, puntuaciones IMDb + Rotten Tomatoes (OMDb, RT puede faltar) y MyAnimeList.
- Estados Por ver / Viendo / Finalizado / Dejado; contador − / + y edición manual solo numérica; superar el total fija el máximo y finaliza.
- Mi lista con pestañas por estado, favoritos, filtro por tipo y por título.

### Fase 4 · Perfil (0.5.0)
- Horas totales (duración fija 50/90/23 min por tipo) y formato escalonado horas → días → semanas → meses → años (con tests).
- Contadores por estado, terminadas por tipo, top 10 de favoritas, avatar con recorte circular (arrastrar y zoom).
- 4.6: `USE_REAL_RUNTIME=true` usa la duración media real de TMDB/Jikan (desactivado por defecto).

### Fase 5 · Despliegue y compartir (0.6.0)
- Perfil público `/u/<token>` de solo lectura (desactivado por defecto, opcionalmente con la lista, token revocable).
- Exportar datos en JSON. `Dockerfile`, `render.yaml` y `docs/DESPLIEGUE.md`. **Falta publicar** (necesita cuenta de hosting); la imagen Docker no se pudo construir aquí (motor no iniciado).
- Producción: cookie `Secure` solo con HTTPS, `JWT_SECRET` obligatorio.

### Fase 6 · Amigos (0.7.0)
- Solicitudes (con aceptación automática si ya te habían enviado una), tarjetas de amigos, y perfil / lista / amigos del amigo con menú "Su perfil / Su lista / Sus amigos". Solo se ven perfiles de amigos.

### Fase 7 · Listas conjuntas (0.8.0)
- Lista entre dos amigos, editable por ambos. Historial por modificación (quién, qué, cuándo) y **Rollback** que restaura el estado de ese punto y queda registrado. Límite configurable (50 por defecto, mínimo 15).

### Fase 8 · Opcionales (0.9.0)
- Recuperar contraseña y verificar correo (el "correo" es un enlace en la consola del servidor hasta configurar un servicio de envío).
- Buzón de ideas en `/roadmap`, solo desde localhost.

### Otros
- **Probado con las APIs reales** (TMDB con token v4 y OMDb): búsqueda en español, ficha (62 episodios, IMDb 9,5, Rotten Tomatoes 96 %), favorito y perfil correctos.
- Red corporativa con inspección HTTPS: `scripts/ca.js` pasa `certs/corporate-ca.pem` a Node (`NODE_EXTRA_CA_CERTS`) en `dev` y `share`.
- Corte automático de proveedores caídos (60 s) y timeout de Jikan de 5 s: una API bloqueada ya no ralentiza cada búsqueda (de ~16 s a ~0,5 s).
- `npm run share` (5.7): túnel temporal de Cloudflare (`tools/cloudflared`) hacia el servidor de desarrollo (:3001, que sirve `client/dist`) para probar desde otras máquinas mientras se pospone el hosting. **Una sola base de datos** (`data/mar.db`). Se niega a abrir el túnel si el servidor usa el `JWT_SECRET` por defecto (`/api/health` informa `devSecret` fuera de producción). `trust proxy = loopback` en local para cookie `Secure` e IP real tras el túnel.
- Limpieza: cuenta `prueba` duplicada (existía en la base de desarrollo y en la que usaba el modo compartido, entonces separada) eliminada de la base compartida; unificadas las bases. 82 tests.
- 80 tests (Vitest): dominio y API completa contra proveedores simulados. Prueba end-to-end en navegador (Edge) del flujo completo.
- Roadmap: versiones por fase y buzón de ideas.

## 0.1.0 · 2026-10-13 · Fase 0 · Base y roadmap
- Monorepo con npm workspaces (`client`, `server`) compatible con Node 16.20.2.
- Servidor Express con `GET /api/health` y `GET /api/roadmap`.
- Página de roadmap pública y de solo lectura (columnas por fase, tarjetas, filtro, progreso) con refresco automático por polling cada 4 s.
- `npm run dev` levanta cliente y servidor e imprime las URLs. `.env.example`, `.gitignore`, README y documentación inicial.
