import "server-only"

import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

// One SQLite connection per process, kept on globalThis so dev HMR reuses it.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  letterbox TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, slug)
);
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display TEXT NOT NULL CHECK (display IN ('fixed', 'fill')),
  design_width INTEGER NOT NULL,
  sort INTEGER NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_draft ON pages(draft_id, sort);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS threads_page ON threads(page_id);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS comments_thread ON comments(thread_id, created_at);
`

const g = globalThis as unknown as { __draftlyDb?: DatabaseSync }

export function db(): DatabaseSync {
  if (!g.__draftlyDb) {
    const dir = resolve(process.env.DRAFTLY_DATA_DIR ?? "./data")
    mkdirSync(dir, { recursive: true })
    const conn = new DatabaseSync(join(dir, "draftly.sqlite"))
    conn.exec(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;"
    )
    conn.exec(SCHEMA)
    g.__draftlyDb = conn
  }
  return g.__draftlyDb
}

/** Runs fn in a transaction (synchronous; node:sqlite is sync). */
export function tx<T>(fn: () => T): T {
  const conn = db()
  conn.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    conn.exec("COMMIT")
    return result
  } catch (err) {
    conn.exec("ROLLBACK")
    throw err
  }
}

export function now(): string {
  return new Date().toISOString()
}
