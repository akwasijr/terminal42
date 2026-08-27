import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = new Database(join(dir, 'terminal42.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at INTEGER NOT NULL,
      last_opened_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      copilot_session_id TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, last_active_at DESC);
  `)

  // Idempotent additive migrations
  const cols = d.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === 'model')) {
    d.exec(`ALTER TABLE sessions ADD COLUMN model TEXT`)
  }
  if (!cols.some((c) => c.name === 'title_locked')) {
    d.exec(`ALTER TABLE sessions ADD COLUMN title_locked INTEGER NOT NULL DEFAULT 0`)
  }
  const projectCols = d.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[]
  if (!projectCols.some((c) => c.name === 'auto_launch_copilot')) {
    d.exec(`ALTER TABLE projects ADD COLUMN auto_launch_copilot INTEGER NOT NULL DEFAULT 1`)
  }
  // designs table may pre-date the brief column; check after CREATE TABLE block runs.
  const designsExists = d.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='designs'`
  ).get() as { name: string } | undefined
  if (designsExists) {
    const designCols = d.prepare(`PRAGMA table_info(designs)`).all() as { name: string }[]
    if (!designCols.some((c) => c.name === 'brief')) {
      d.exec(`ALTER TABLE designs ADD COLUMN brief TEXT`)
    }
  }
  // looms table may pre-date the template_id column.
  const loomsExists = d.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='looms'`
  ).get() as { name: string } | undefined
  if (loomsExists) {
    const loomCols = d.prepare(`PRAGMA table_info(looms)`).all() as { name: string }[]
    if (!loomCols.some((c) => c.name === 'template_id')) {
      d.exec(`ALTER TABLE looms ADD COLUMN template_id TEXT`)
    }
  }

  d.exec(`
    CREATE TABLE IF NOT EXISTS composer_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_composer_session ON composer_history(session_id, id DESC);

    CREATE TABLE IF NOT EXISTS composer_drafts (
      session_id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_log_session ON session_log(session_id, id DESC);

    CREATE TABLE IF NOT EXISTS preview_commands (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      framework TEXT,
      preferred_port INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inbox_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_unread ON inbox_entries(read, created_at DESC);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      status TEXT NOT NULL DEFAULT 'done',
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id, created_at);

    -- Motion pieces. The document is a single JSON blob rather than columns
    -- because it is only ever read and written whole, and its shape changes
    -- every time a component gains a parameter -- which would otherwise mean a
    -- migration per slider.
    CREATE TABLE IF NOT EXISTS motion_docs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      doc TEXT NOT NULL,
      thumbnail TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_motion_recent ON motion_docs(updated_at DESC);

    -- Saved layouts: a document's parameters without its images, so a look can
    -- be reapplied to different content.
    CREATE TABLE IF NOT EXISTS motion_layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      component_id TEXT NOT NULL,
      doc TEXT NOT NULL,
      thumbnail TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_motion_layouts ON motion_layouts(created_at DESC);

    -- Bentos: a named set of pictures, kept apart from layouts because they
    -- are the other half of the same decision. A layout is a motion without
    -- its images; a bento is images without a motion, so the two can be
    -- combined freely.
    CREATE TABLE IF NOT EXISTS motion_bentos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      images TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_motion_bentos ON motion_bentos(created_at DESC);

    -- Brand sets: colours and typefaces a piece can be built from, kept
    -- outside the document because a brand outlives any one piece. Held as
    -- one table with a kind rather than a table per kind, since every kind
    -- is the same shape -- a name and a short list -- and a new kind should
    -- not need a migration.
    CREATE TABLE IF NOT EXISTS motion_brand_sets (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      items TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_motion_brand_sets ON motion_brand_sets(kind, created_at);

    -- Token studios. One row is a whole studio: its sets, its themes and all
    -- its tokens, as a single JSON blob, for the same reason a Motion document
    -- is. A studio is read and written whole, and its shape gains a field
    -- whenever a token type is added, which would otherwise be a migration per
    -- kind of value.
    CREATE TABLE IF NOT EXISTS token_studios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      studio TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_token_studios_recent ON token_studios(updated_at DESC);

    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cwd TEXT NOT NULL,
      copilot_session_id TEXT,
      current_version TEXT,
      brief TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_designs_recent ON designs(last_active_at DESC);

    CREATE TABLE IF NOT EXISTS design_messages (
      id TEXT PRIMARY KEY,
      design_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      status TEXT NOT NULL DEFAULT 'done',
      version_at_turn TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(design_id) REFERENCES designs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_design_messages ON design_messages(design_id, created_at);

    CREATE TABLE IF NOT EXISTS settings_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_schedules (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      hour INTEGER,
      minute INTEGER,
      interval_minutes INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_due ON recipe_schedules(enabled, next_run_at);

    CREATE TABLE IF NOT EXISTS browser_urls (
      project_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      url TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (project_id, session_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_browser_urls_proj ON browser_urls(project_id);

    CREATE TABLE IF NOT EXISTS browser_open_state (
      project_id TEXT PRIMARY KEY,
      is_open INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS looms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cwd TEXT NOT NULL,
      summary TEXT,
      response_style TEXT,
      template_id TEXT,
      copilot_session_id TEXT,
      project_id TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_looms_recent ON looms(last_active_at DESC);

    CREATE TABLE IF NOT EXISTS loom_sources (
      id TEXT PRIMARY KEY,
      loom_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      origin_url TEXT,
      origin_path TEXT,
      origin_ref_type TEXT,
      origin_ref_id TEXT,
      mime_type TEXT,
      byte_size INTEGER,
      content_hash TEXT,
      text_hash TEXT,
      original_path TEXT,
      extracted_text_path TEXT,
      char_count INTEGER,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      summary_status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      etag TEXT,
      last_modified TEXT,
      last_fetched_at INTEGER,
      included INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (loom_id) REFERENCES looms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_loom_sources_loom ON loom_sources(loom_id, created_at);

    CREATE TABLE IF NOT EXISTS loom_messages (
      id TEXT PRIMARY KEY,
      loom_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      status TEXT NOT NULL DEFAULT 'done',
      citations TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (loom_id) REFERENCES looms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_loom_messages ON loom_messages(loom_id, created_at);

    CREATE TABLE IF NOT EXISTS loom_notes (
      id TEXT PRIMARY KEY,
      loom_id TEXT NOT NULL,
      title TEXT,
      body TEXT NOT NULL,
      source_message_id TEXT,
      is_source INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (loom_id) REFERENCES looms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_loom_notes ON loom_notes(loom_id, created_at);

    CREATE TABLE IF NOT EXISTS loom_artifacts (
      id TEXT PRIMARY KEY,
      loom_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      content_path TEXT,
      content_inline TEXT,
      source_ids TEXT,
      prompt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      design_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (loom_id) REFERENCES looms(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_loom_artifacts ON loom_artifacts(loom_id, created_at);
  `)

  // chat_messages pre-dates turn-scoped diffs. `snapshot_tree` is the git tree
  // frozen just before the turn ran, `diff_cwd` the repo it was taken in
  // (stored rather than re-derived, so undo still works if the project is
  // later re-pointed), and `undone` stops a card offering Undo twice.
  const chatCols = d.prepare(`PRAGMA table_info(chat_messages)`).all() as { name: string }[]
  if (chatCols.length > 0) {
    if (!chatCols.some((c) => c.name === 'snapshot_tree')) {
      d.exec(`ALTER TABLE chat_messages ADD COLUMN snapshot_tree TEXT`)
    }
    if (!chatCols.some((c) => c.name === 'diff_json')) {
      d.exec(`ALTER TABLE chat_messages ADD COLUMN diff_json TEXT`)
    }
    if (!chatCols.some((c) => c.name === 'diff_cwd')) {
      d.exec(`ALTER TABLE chat_messages ADD COLUMN diff_cwd TEXT`)
    }
    if (!chatCols.some((c) => c.name === 'undone')) {
      d.exec(`ALTER TABLE chat_messages ADD COLUMN undone INTEGER NOT NULL DEFAULT 0`)
    }
    // `snapshot_local` is the id of a local-copy manifest covering what git
    // could not: everything, when the folder is not a repository, or just the
    // .gitignore'd files when it is. Null on rows written before local copies
    // existed, which still undo correctly from `snapshot_tree` alone.
    if (!chatCols.some((c) => c.name === 'snapshot_local')) {
      d.exec(`ALTER TABLE chat_messages ADD COLUMN snapshot_local TEXT`)
    }
  }
}

export type ProjectRow = {
  id: string
  name: string
  path: string
  color: string | null
  created_at: number
  last_opened_at: number
  auto_launch_copilot: number
}

export type SessionRow = {
  id: string
  project_id: string | null
  title: string
  copilot_session_id: string | null
  model: string | null
  pinned: number
  created_at: number
  last_active_at: number
  title_locked: number
}

export type PreviewCommandRow = {
  id: string
  project_id: string
  name: string
  command: string
  framework: string | null
  preferred_port: number | null
  created_at: number
}

export type InboxEntryRow = {
  id: string
  title: string
  body: string
  kind: string
  read: number
  created_at: number
}

export type RecipeScheduleRow = {
  id: string
  recipe_id: string
  kind: 'daily' | 'weekdays' | 'interval'
  hour: number | null
  minute: number | null
  interval_minutes: number | null
  enabled: number
  last_run_at: number | null
  next_run_at: number
  created_at: number
}

export type LoomRow = {
  id: string
  title: string
  cwd: string
  summary: string | null
  response_style: string | null
  template_id: string | null
  copilot_session_id: string | null
  project_id: string | null
  created_at: number
  last_active_at: number
}

export type LoomSourceRow = {
  id: string
  loom_id: string
  kind: string
  title: string
  origin_url: string | null
  origin_path: string | null
  origin_ref_type: string | null
  origin_ref_id: string | null
  mime_type: string | null
  byte_size: number | null
  content_hash: string | null
  text_hash: string | null
  original_path: string | null
  extracted_text_path: string | null
  char_count: number | null
  summary: string | null
  status: string
  summary_status: string
  error: string | null
  etag: string | null
  last_modified: string | null
  last_fetched_at: number | null
  included: number
  created_at: number
  updated_at: number
}

export type LoomMessageRow = {
  id: string
  loom_id: string
  role: string
  content: string
  tool_calls: string | null
  status: string
  citations: string | null
  created_at: number
}

export type LoomNoteRow = {
  id: string
  loom_id: string
  title: string | null
  body: string
  source_message_id: string | null
  is_source: number
  created_at: number
  updated_at: number
}

export type LoomArtifactRow = {
  id: string
  loom_id: string
  kind: string
  title: string
  content_path: string | null
  content_inline: string | null
  source_ids: string | null
  prompt: string | null
  status: string
  error: string | null
  design_id: string | null
  created_at: number
  updated_at: number
}
