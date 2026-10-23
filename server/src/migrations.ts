// Migraciones versionadas. NUNCA editar una ya publicada: añadir una nueva.
export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'usuarios',
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        avatar TEXT,
        avatar_v INTEGER NOT NULL DEFAULT 0,
        share_enabled INTEGER NOT NULL DEFAULT 0,
        share_list INTEGER NOT NULL DEFAULT 0,
        share_token TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'contenido y biblioteca',
    sql: `
      CREATE TABLE content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        poster_url TEXT,
        synopsis TEXT,
        year INTEGER,
        total_episodes INTEGER,
        runtime_minutes INTEGER,
        studio TEXT,
        imdb_id TEXT,
        ratings TEXT,
        detailed_at TEXT,
        ratings_at TEXT,
        ratings_try_at TEXT,
        UNIQUE (source, external_id)
      );
      CREATE TABLE user_content (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'POR_VER',
        watched_episodes INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, content_id)
      );
      CREATE INDEX idx_user_content_user ON user_content(user_id, status);
      CREATE TABLE api_cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'amistades',
    sql: `
      CREATE TABLE friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        UNIQUE (requester_id, addressee_id)
      );
    `,
  },
  {
    version: 4,
    name: 'listas conjuntas',
    sql: `
      CREATE TABLE joint_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE joint_list_members (
        list_id INTEGER NOT NULL REFERENCES joint_lists(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (list_id, user_id)
      );
      CREATE TABLE joint_list_items (
        list_id INTEGER NOT NULL REFERENCES joint_lists(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'POR_VER',
        watched_episodes INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (list_id, content_id)
      );
      CREATE TABLE joint_list_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL REFERENCES joint_lists(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_joint_history ON joint_list_history(list_id, content_id, id);
    `,
  },
  {
    version: 5,
    name: 'tokens de recuperación y verificación',
    sql: `
      CREATE TABLE auth_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 6,
    name: "enlaces de amistad",
    sql: `
      -- Cada enlace guarda quién lo generó (creator_id).
      --   befriend: quien lo abre pasa a ser amigo de creator_id (target_id = 0).
      --   request:  quien lo abre envía una solicitud a target_id (el enlace lo generó creator_id al compartir su perfil).
      CREATE TABLE invite_links (
        token TEXT PRIMARY KEY,
        creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        target_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (creator_id, kind, target_id)
      );
    `,
  },
  {
    version: 7,
    name: 'visibilidad del perfil',
    sql: `
      -- 0 = solo amigos (por defecto), 1 = público (cualquiera puede verlo, también sin cuenta).
      -- Quien ya tenía activado el enlace para compartir pasa a perfil público.
      ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 0;
      UPDATE users SET profile_public = share_enabled;
    `,
  },
  {
    version: 8,
    name: 'ciclo de vida de las listas conjuntas',
    sql: `
      -- La pareja se guarda aparte de los miembros: así «vuestra lista» se encuentra aunque alguien haya salido.
      ALTER TABLE joint_lists ADD COLUMN user_a INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE joint_lists ADD COLUMN user_b INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE joint_lists ADD COLUMN last_activity_at TEXT;
      -- left_at NULL = es miembro activo; con fecha = ha salido (la lista se conserva).
      ALTER TABLE joint_list_members ADD COLUMN left_at TEXT;
      UPDATE joint_lists SET
        user_a = COALESCE((SELECT MIN(user_id) FROM joint_list_members m WHERE m.list_id = joint_lists.id), 0),
        user_b = COALESCE((SELECT MAX(user_id) FROM joint_list_members m WHERE m.list_id = joint_lists.id), 0),
        last_activity_at = COALESCE((SELECT MAX(created_at) FROM joint_list_history h WHERE h.list_id = joint_lists.id), created_at);
    `,
  },
  {
    version: 9,
    name: 'revisionado',
    sql: `
      -- prev_episodes: episodios de visionados anteriores (ya terminados); siguen contando en las estadísticas.
      -- rewatch: nº de veces que se ha vuelto a ver (>0 = «Reviendo» mientras no se finalice de nuevo).
      ALTER TABLE user_content ADD COLUMN prev_episodes INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_content ADD COLUMN rewatch INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 10,
    name: 'tema de la interfaz',
    sql: `
      -- theme: preferencia de la persona ('dark' por defecto, 'light'); se aplica al iniciar sesión en cualquier dispositivo.
      ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark';
    `,
  },
  {
    version: 11,
    name: 'géneros',
    sql: `
      -- genres: JSON con los ids de género de TMDB (p. ej. [18,80]); NULL = aún no consultado. Alimenta las recomendaciones.
      ALTER TABLE content ADD COLUMN genres TEXT;
    `,
  },
  {
    version: 12,
    name: 'temporadas',
    sql: `
      -- seasons: JSON con [{number, episodes}] de cada serie (sin especiales); NULL = aún no consultado, [] = sin datos.
      ALTER TABLE content ADD COLUMN seasons TEXT;
    `,
  },
  {
    version: 13,
    name: 'notificaciones de novedades',
    sql: `
      -- Ajustes de la persona: solo favoritos y si ya vio la ventana explicativa de la campana.
      ALTER TABLE users ADD COLUMN notif_favorites_only INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN notif_intro_seen INTEGER NOT NULL DEFAULT 0;
      -- Última vez que se programó un refresco de novedades para esta persona.
      ALTER TABLE users ADD COLUMN news_checked_at TEXT;
      -- Instantánea de novedades de cada contenido (temporadas, películas de la saga o relacionadas), compartida por todas
      -- las personas que lo tienen, y cuándo se calculó.
      ALTER TABLE content ADD COLUMN news TEXT;
      ALTER TABLE content ADD COLUMN news_at TEXT;
      -- Lo que ya se conocía de ese contenido cuando la persona lo tenía en su lista: solo lo posterior es novedad.
      ALTER TABLE user_content ADD COLUMN news_base TEXT;
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        dedupe_key TEXT NOT NULL,
        season INTEGER,
        air_date TEXT,
        related_content_id INTEGER REFERENCES content(id) ON DELETE SET NULL,
        related_title TEXT,
        created_at TEXT NOT NULL,
        seen_at TEXT,
        UNIQUE (user_id, dedupe_key)
      );
      CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
    `,
  },
  {
    version: 14,
    name: 'fecha de estreno',
    sql: `
      -- Estreno de la película o primer episodio de la serie (AAAA-MM-DD): lo que aún no ha salido solo admite «Por ver».
      ALTER TABLE content ADD COLUMN release_date TEXT;
    `,
  },
  {
    version: 15,
    name: 'anime desde la API oficial de MyAnimeList',
    sql: `
      -- La API pública de Jikan cerró: el anime pasa a la API oficial de MAL. Los ids son los mismos (ids de MAL),
      -- así que solo cambia el nombre de la fuente y todo lo guardado sigue enlazado.
      UPDATE content SET source = 'mal' WHERE source = 'jikan';
    `,
  },
  {
    version: 16,
    name: 'notificaciones descartadas',
    sql: `
      -- Aviso descartado por la persona: no se muestra, pero la fila se conserva para que (user_id, dedupe_key) no lo vuelva a crear.
      ALTER TABLE notifications ADD COLUMN dismissed_at TEXT;
    `,
  },
];
