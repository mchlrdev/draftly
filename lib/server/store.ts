import "server-only"

import {
  DEFAULT_DESIGN_WIDTH,
  DEFAULT_LETTERBOX,
  MAX_COMMENT_LENGTH,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  type Comment,
  type DisplayMode,
  type Draft,
  type DraftSnapshot,
  type DraftSummary,
  type Page,
  type Project,
  type Thread,
  type ThreadStatus,
} from "@/lib/api-types"
import { db, now, tx } from "./db"
import { generatePassword, hashPassword, newId, verifyPassword } from "./crypto"
import { publish } from "./events"
import { HttpError, notFound, unprocessable } from "./http"

// Domain operations over SQLite. Inputs are untrusted (validated here);
// outputs are the wire types from lib/api-types.ts.

// ---------- rows ----------

interface ProjectRow {
  id: number
  slug: string
  title: string
  created_at: string
}

export interface DraftRow {
  id: string
  project_id: number
  slug: string
  password_hash: string
  letterbox: string
  created_at: string
  project_slug: string
  project_title: string
}

interface PageRow {
  id: string
  draft_id: string
  name: string
  display: DisplayMode
  design_width: number
  sort: number
  created_at: string
  updated_at: string
}

interface ThreadRow {
  id: string
  page_id: string
  x: number
  y: number
  status: ThreadStatus
  created_at: string
  resolved_at: string | null
}

interface CommentRow {
  id: string
  thread_id: string
  author_name: string
  client_id: string
  body: string
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

const toPage = (r: PageRow): Page => ({
  id: r.id,
  name: r.name,
  display: r.display,
  designWidth: r.design_width,
  sort: r.sort,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  threadId: r.thread_id,
  authorName: r.author_name,
  clientId: r.client_id,
  body: r.deleted_at ? "" : r.body,
  createdAt: r.created_at,
  editedAt: r.edited_at,
  deletedAt: r.deleted_at,
})

// ---------- validation ----------

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function projectSlug(v: unknown): string {
  const slug = str(v).trim()
  if (!SLUG_PATTERN.test(slug))
    throw unprocessable("Kürzel: nur Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang oder Ende).")
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) throw unprocessable(`„${slug}“ ist reserviert.`)
  return slug
}

function draftSlug(v: unknown): string {
  const slug = str(v).trim()
  if (!SLUG_PATTERN.test(slug))
    throw unprocessable("Kürzel: nur Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang oder Ende).")
  return slug
}

function letterbox(v: unknown): string {
  const s = str(v).trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw unprocessable("Farbe bitte als #RRGGBB angeben.")
  return s.toUpperCase()
}

function display(v: unknown): DisplayMode {
  if (v === "fixed" || v === "fill") return v
  throw unprocessable("Darstellung muss „fixed“ oder „fill“ sein.")
}

function designWidth(v: unknown): number {
  const n = typeof v === "number" ? v : Number(str(v).trim())
  if (!Number.isInteger(n) || n < 200 || n > 10000) throw unprocessable("Designbreite muss eine ganze Zahl zwischen 200 und 10000 sein.")
  return n
}

function pageName(v: unknown): string {
  const s = str(v).trim()
  if (!s || s.length > 120) throw unprocessable("Seitenname muss 1–120 Zeichen lang sein.")
  return s
}

function commentBody(v: unknown): string {
  const s = str(v).trim()
  if (!s || s.length > MAX_COMMENT_LENGTH) throw unprocessable(`Kommentar muss 1–${MAX_COMMENT_LENGTH} Zeichen lang sein.`)
  return s
}

function authorName(v: unknown): string {
  const s = str(v).trim()
  if (!s || s.length > 60) throw unprocessable("Name muss 1–60 Zeichen lang sein.")
  return s
}

function clientId(v: unknown): string {
  const s = str(v).trim()
  if (!s || s.length > 200) throw unprocessable("clientId fehlt.")
  return s
}

function coord(v: unknown, axis: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw unprocessable(`${axis} muss eine Zahl ≥ 0 sein.`)
  return v
}

export const MAX_HTML_BYTES = 25 * 1024 * 1024

/** Uploaded HTML must be self-contained: no http(s) URL anywhere. */
export function validateHtml(html: string): string {
  if (!html.trim()) throw unprocessable("Die Datei ist leer.")
  if (/https?:/i.test(html))
    throw unprocessable("Die Datei enthält http(s)-Links. Bitte alle Bilder, Schriften und Styles direkt einbetten.")
  return html
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message)
}

// ---------- projects ----------

function summaries(projectId: number): DraftSummary[] {
  const rows = db()
    .prepare(
      `SELECT d.slug, p.slug AS project_slug, d.letterbox, d.created_at,
        (SELECT COUNT(*) FROM pages pg WHERE pg.draft_id = d.id) AS page_count,
        (SELECT COUNT(*) FROM threads t JOIN pages pg ON pg.id = t.page_id
          WHERE pg.draft_id = d.id AND t.status = 'open') AS open_count
       FROM drafts d JOIN projects p ON p.id = d.project_id
       WHERE d.project_id = ? ORDER BY d.created_at DESC, d.rowid DESC`,
    )
    .all(projectId) as unknown as {
    slug: string
    project_slug: string
    letterbox: string
    created_at: string
    page_count: number
    open_count: number
  }[]
  return rows.map((r) => ({
    slug: r.slug,
    projectSlug: r.project_slug,
    letterbox: r.letterbox,
    createdAt: r.created_at,
    pageCount: Number(r.page_count),
    openThreadCount: Number(r.open_count),
  }))
}

const toProject = (r: ProjectRow): Project => ({
  slug: r.slug,
  title: r.title,
  createdAt: r.created_at,
  drafts: summaries(r.id),
})

function projectRow(slug: string): ProjectRow | undefined {
  return db().prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as ProjectRow | undefined
}

function requireProject(slug: string): ProjectRow {
  const row = projectRow(slug)
  if (!row) throw notFound("Projekt nicht gefunden.")
  return row
}

export function listProjects(): Project[] {
  const rows = db().prepare("SELECT * FROM projects ORDER BY created_at DESC, id DESC").all() as unknown as ProjectRow[]
  return rows.map(toProject)
}

export function getProject(slug: string): Project | null {
  const row = projectRow(slug)
  return row ? toProject(row) : null
}

export function createProject(input: { slug?: unknown; title?: unknown }): Project {
  const slug = projectSlug(input.slug)
  const title = str(input.title).trim() || slug
  if (title.length > 120) throw unprocessable("Titel darf höchstens 120 Zeichen lang sein.")
  try {
    db().prepare("INSERT INTO projects (slug, title, created_at) VALUES (?, ?, ?)").run(slug, title, now())
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `Das Projekt „${slug}“ gibt es schon.`)
    throw err
  }
  return getProject(slug)!
}

export function deleteProject(slug: string, force: boolean): void {
  const row = requireProject(slug)
  const { n } = db().prepare("SELECT COUNT(*) AS n FROM drafts WHERE project_id = ?").get(row.id) as { n: number }
  if (Number(n) > 0 && !force) throw new HttpError(409, "Das Projekt enthält noch Entwürfe.")
  db().prepare("DELETE FROM projects WHERE id = ?").run(row.id)
}

// ---------- drafts ----------

const DRAFT_SELECT = `SELECT d.*, p.slug AS project_slug, p.title AS project_title
  FROM drafts d JOIN projects p ON p.id = d.project_id`

export function findDraft(project: string, draft: string): DraftRow | undefined {
  return db().prepare(`${DRAFT_SELECT} WHERE p.slug = ? AND d.slug = ?`).get(project, draft) as DraftRow | undefined
}

export function requireDraft(project: string, draft: string): DraftRow {
  const row = findDraft(project, draft)
  if (!row) throw notFound("Entwurf nicht gefunden.")
  return row
}

function pageRows(draftId: string): PageRow[] {
  return db()
    .prepare(
      "SELECT id, draft_id, name, display, design_width, sort, created_at, updated_at FROM pages WHERE draft_id = ? ORDER BY sort, created_at",
    )
    .all(draftId) as unknown as PageRow[]
}

export function toDraft(row: DraftRow): Draft {
  const summary = summaries(row.project_id).find((s) => s.slug === row.slug)!
  return { ...summary, projectTitle: row.project_title, pages: pageRows(row.id).map(toPage) }
}

export function createDraft(project: string, input: { slug?: unknown; letterbox?: unknown }) {
  const p = requireProject(project)
  const slug = draftSlug(input.slug)
  const color = input.letterbox === undefined || input.letterbox === null ? DEFAULT_LETTERBOX : letterbox(input.letterbox)
  const password = generatePassword()
  try {
    db()
      .prepare("INSERT INTO drafts (id, project_id, slug, password_hash, letterbox, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId(9), p.id, slug, hashPassword(password), color, now())
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `Den Entwurf „${slug}“ gibt es in diesem Projekt schon.`)
    throw err
  }
  return { draft: toDraft(requireDraft(project, slug)), password }
}

export function updateDraft(project: string, draft: string, input: { letterbox?: unknown }): Draft {
  const row = requireDraft(project, draft)
  if (input.letterbox !== undefined) {
    db().prepare("UPDATE drafts SET letterbox = ? WHERE id = ?").run(letterbox(input.letterbox), row.id)
  }
  return toDraft(requireDraft(project, draft))
}

export function rotatePassword(project: string, draft: string): { password: string } {
  const row = requireDraft(project, draft)
  const password = generatePassword()
  db().prepare("UPDATE drafts SET password_hash = ? WHERE id = ?").run(hashPassword(password), row.id)
  return { password }
}

export function deleteDraft(project: string, draft: string): void {
  const row = requireDraft(project, draft)
  db().prepare("DELETE FROM drafts WHERE id = ?").run(row.id)
}

/** Draft row when the password matches; undefined for wrong password or unknown draft. */
export function checkDraftPassword(project: string, draft: string, password: unknown): DraftRow | undefined {
  const row = findDraft(project, draft)
  // Hash anyway on a miss so timing does not reveal whether the draft exists.
  const hash = row?.password_hash ?? DUMMY_HASH()
  const ok = typeof password === "string" && password.length <= 200 && verifyPassword(password.trim().toLowerCase(), hash)
  return row && ok ? row : undefined
}

let dummy: string | undefined
const DUMMY_HASH = () => (dummy ??= hashPassword(generatePassword()))

// ---------- pages ----------

function requirePage(draftId: string, pageId: string): PageRow {
  const row = db()
    .prepare(
      "SELECT id, draft_id, name, display, design_width, sort, created_at, updated_at FROM pages WHERE id = ? AND draft_id = ?",
    )
    .get(pageId, draftId) as PageRow | undefined
  if (!row) throw notFound("Seite nicht gefunden.")
  return row
}

export interface PageInput {
  html?: string
  fileName?: string
  name?: unknown
  display?: unknown
  designWidth?: unknown
}

export function createPage(project: string, draft: string, input: PageInput): Page {
  const d = requireDraft(project, draft)
  if (input.html === undefined) throw unprocessable("Bitte eine HTML-Datei auswählen.")
  const html = validateHtml(input.html)
  const fallbackName = (input.fileName ?? "").replace(/\.html?$/i, "").trim() || "Seite"
  const name = pageName(str(input.name).trim() ? input.name : fallbackName)
  const mode = input.display === undefined || input.display === "" ? "fixed" : display(input.display)
  const width =
    input.designWidth === undefined || input.designWidth === "" ? DEFAULT_DESIGN_WIDTH : designWidth(input.designWidth)
  const id = newId(9)
  const t = now()
  tx(() => {
    const { m } = db().prepare("SELECT COALESCE(MAX(sort), -1) AS m FROM pages WHERE draft_id = ?").get(d.id) as {
      m: number
    }
    db()
      .prepare(
        "INSERT INTO pages (id, draft_id, name, display, design_width, sort, html, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, d.id, name, mode, width, Number(m) + 1, html, t, t)
  })
  return toPage(requirePage(d.id, id))
}

/** Replaces HTML (and optionally metadata). Same id, threads kept. */
export function replacePage(project: string, draft: string, pageId: string, input: PageInput): Page {
  const d = requireDraft(project, draft)
  requirePage(d.id, pageId)
  if (input.html === undefined) throw unprocessable("Bitte eine HTML-Datei auswählen.")
  const html = validateHtml(input.html)
  db().prepare("UPDATE pages SET html = ?, updated_at = ? WHERE id = ?").run(html, now(), pageId)
  return updatePage(project, draft, pageId, input)
}

export function updatePage(project: string, draft: string, pageId: string, input: Omit<PageInput, "html">): Page {
  const d = requireDraft(project, draft)
  requirePage(d.id, pageId)
  const sets: string[] = []
  const values: (string | number)[] = []
  if (input.name !== undefined && input.name !== "") {
    sets.push("name = ?")
    values.push(pageName(input.name))
  }
  if (input.display !== undefined && input.display !== "") {
    sets.push("display = ?")
    values.push(display(input.display))
  }
  if (input.designWidth !== undefined && input.designWidth !== "") {
    sets.push("design_width = ?")
    values.push(designWidth(input.designWidth))
  }
  if (sets.length) {
    sets.push("updated_at = ?")
    values.push(now())
    db()
      .prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values, pageId)
  }
  return toPage(requirePage(d.id, pageId))
}

export function reorderPages(project: string, draft: string, order: unknown): Page[] {
  const d = requireDraft(project, draft)
  const current = pageRows(d.id).map((p) => p.id)
  const ids = Array.isArray(order) ? order : null
  const valid =
    ids &&
    ids.length === current.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => typeof id === "string" && current.includes(id))
  if (!valid) throw unprocessable("Die Reihenfolge muss jede Seite genau einmal enthalten.")
  tx(() => {
    const stmt = db().prepare("UPDATE pages SET sort = ? WHERE id = ?")
    ;(ids as string[]).forEach((id, i) => stmt.run(i, id))
  })
  return pageRows(d.id).map(toPage)
}

export function deletePage(project: string, draft: string, pageId: string): void {
  const d = requireDraft(project, draft)
  requirePage(d.id, pageId)
  db().prepare("DELETE FROM pages WHERE id = ?").run(pageId)
}

export function pageHtml(draftId: string, pageId: string): string {
  const row = db().prepare("SELECT html FROM pages WHERE id = ? AND draft_id = ?").get(pageId, draftId) as
    | { html: string }
    | undefined
  if (!row) throw notFound("Seite nicht gefunden.")
  return row.html
}

// ---------- threads & comments ----------

function commentsFor(threadIds: string[]): Map<string, Comment[]> {
  const map = new Map<string, Comment[]>()
  if (!threadIds.length) return map
  const rows = db()
    .prepare(
      `SELECT * FROM comments WHERE thread_id IN (${threadIds.map(() => "?").join(",")}) ORDER BY created_at, rowid`,
    )
    .all(...threadIds) as unknown as CommentRow[]
  for (const r of rows) {
    const list = map.get(r.thread_id) ?? []
    list.push(toComment(r))
    map.set(r.thread_id, list)
  }
  return map
}

function toThreads(rows: ThreadRow[]): Thread[] {
  const comments = commentsFor(rows.map((r) => r.id))
  return rows.map((r) => ({
    id: r.id,
    pageId: r.page_id,
    x: r.x,
    y: r.y,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    comments: comments.get(r.id) ?? [],
  }))
}

function requireThread(draftId: string, threadId: string): ThreadRow {
  const row = db()
    .prepare("SELECT t.* FROM threads t JOIN pages p ON p.id = t.page_id WHERE t.id = ? AND p.draft_id = ?")
    .get(threadId, draftId) as ThreadRow | undefined
  if (!row) throw notFound("Thread nicht gefunden.")
  return row
}

function requireComment(draftId: string, commentId: string): CommentRow {
  const row = db()
    .prepare(
      `SELECT c.* FROM comments c JOIN threads t ON t.id = c.thread_id JOIN pages p ON p.id = t.page_id
       WHERE c.id = ? AND p.draft_id = ?`,
    )
    .get(commentId, draftId) as CommentRow | undefined
  if (!row) throw notFound("Kommentar nicht gefunden.")
  return row
}

const threadById = (draftId: string, id: string) => toThreads([requireThread(draftId, id)])[0]
const commentById = (draftId: string, id: string) => toComment(requireComment(draftId, id))

export function snapshot(row: DraftRow, operator: boolean): DraftSnapshot {
  const threads = db()
    .prepare(
      "SELECT t.* FROM threads t JOIN pages p ON p.id = t.page_id WHERE p.draft_id = ? ORDER BY t.created_at, t.rowid",
    )
    .all(row.id) as unknown as ThreadRow[]
  return { draft: toDraft(row), threads: toThreads(threads), operator }
}

export function createThread(draft: DraftRow, input: Record<string, unknown>): Thread {
  const pageId = str(input.pageId)
  requirePage(draft.id, pageId)
  const x = coord(input.x, "x")
  const y = coord(input.y, "y")
  const body = commentBody(input.body)
  const name = authorName(input.authorName)
  const cid = clientId(input.clientId)
  const id = newId(9)
  const t = now()
  tx(() => {
    db()
      .prepare("INSERT INTO threads (id, page_id, x, y, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)")
      .run(id, pageId, x, y, t)
    db()
      .prepare("INSERT INTO comments (id, thread_id, author_name, client_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId(9), id, name, cid, body, t)
  })
  const thread = threadById(draft.id, id)
  publish(draft.id, { type: "thread.created", thread })
  return thread
}

export function setThreadStatus(draft: DraftRow, threadId: string, status: unknown): Thread {
  requireThread(draft.id, threadId)
  if (status !== "open" && status !== "resolved") throw unprocessable("Status muss „open“ oder „resolved“ sein.")
  db()
    .prepare("UPDATE threads SET status = ?, resolved_at = ? WHERE id = ?")
    .run(status, status === "resolved" ? now() : null, threadId)
  const thread = threadById(draft.id, threadId)
  publish(draft.id, { type: "thread.updated", thread })
  return thread
}

export function deleteThread(draft: DraftRow, threadId: string): void {
  const row = requireThread(draft.id, threadId)
  db().prepare("DELETE FROM threads WHERE id = ?").run(threadId)
  publish(draft.id, { type: "thread.deleted", threadId, pageId: row.page_id })
}

export function addComment(draft: DraftRow, threadId: string, input: Record<string, unknown>): Comment {
  requireThread(draft.id, threadId)
  const body = commentBody(input.body)
  const name = authorName(input.authorName)
  const cid = clientId(input.clientId)
  const id = newId(9)
  db()
    .prepare("INSERT INTO comments (id, thread_id, author_name, client_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, threadId, name, cid, body, now())
  const comment = commentById(draft.id, id)
  publish(draft.id, { type: "comment.created", comment })
  return comment
}

export function editComment(draft: DraftRow, commentId: string, input: Record<string, unknown>): Comment {
  const row = requireComment(draft.id, commentId)
  if (row.deleted_at) throw notFound("Kommentar nicht gefunden.")
  if (str(input.clientId) !== row.client_id) throw new HttpError(403, "Du kannst nur eigene Kommentare bearbeiten.")
  const body = commentBody(input.body)
  db().prepare("UPDATE comments SET body = ?, edited_at = ? WHERE id = ?").run(body, now(), commentId)
  const comment = commentById(draft.id, commentId)
  publish(draft.id, { type: "comment.updated", comment })
  return comment
}

export function removeComment(draft: DraftRow, commentId: string, cid: unknown, operator: boolean): Comment {
  const row = requireComment(draft.id, commentId)
  if (!operator && str(cid) !== row.client_id) throw new HttpError(403, "Du kannst nur eigene Kommentare löschen.")
  if (row.deleted_at) return toComment(row)
  db().prepare("UPDATE comments SET body = '', deleted_at = ? WHERE id = ?").run(now(), commentId)
  const comment = commentById(draft.id, commentId)
  publish(draft.id, { type: "comment.deleted", comment })
  return comment
}
