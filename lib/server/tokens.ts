import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { ApiToken } from "@/lib/api-types"
import { db, now } from "./db"
import { decryptPassword, encryptPassword, newId } from "./crypto"
import { HttpError, notFound, unprocessable } from "./http"
import { requireDraft, type PageInput } from "./store"

// Agent access (ADR 0004): API tokens for the MCP endpoint, and one-time
// upload tickets so an agent can send a large HTML file with curl without
// putting its token in the shell.

const TOKEN_PREFIX = "dft_"
const TICKET_MINUTES = 30

interface TokenRow {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

const toToken = (r: TokenRow): ApiToken => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
})

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url")

export function listTokens(): ApiToken[] {
  const rows = db()
    .prepare(
      "SELECT id, name, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC, rowid DESC"
    )
    .all() as unknown as TokenRow[]
  return rows.map(toToken)
}

// The bearer check uses the hash. The encrypted copy (same AES-GCM scheme as
// draft passwords, AAD bound to the token id) only lets the operator read it.
const tokenAad = (id: string) => `api-token:${id}`

/** Returns the plaintext token; stored as hash plus an encrypted copy. */
export function createToken(input: { name?: unknown }): {
  token: string
  apiToken: ApiToken
} {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name) throw unprocessable("Bitte einen Namen eingeben.")
  if (name.length > 60)
    throw unprocessable("Bitte höchstens 60 Zeichen eingeben.")
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url")
  const id = newId(9)
  db()
    .prepare(
      "INSERT INTO api_tokens (id, name, token_hash, token_enc, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      id,
      name,
      hashToken(token),
      encryptPassword(token, tokenAad(id)),
      now()
    )
  const row = db()
    .prepare(
      "SELECT id, name, created_at, last_used_at FROM api_tokens WHERE id = ?"
    )
    .get(id) as unknown as TokenRow
  return { token, apiToken: toToken(row) }
}

/** The plaintext for the operator; null for tokens made before it was stored. */
export function readToken(id: string): { token: string | null } {
  const row = db()
    .prepare("SELECT token_enc FROM api_tokens WHERE id = ?")
    .get(id) as { token_enc: string | null } | undefined
  if (!row) throw notFound("Token nicht gefunden.")
  return { token: decryptPassword(row.token_enc, tokenAad(id)) }
}

/** Revoking a token also voids its open upload tickets (cascade). */
export function revokeToken(id: string): void {
  const res = db().prepare("DELETE FROM api_tokens WHERE id = ?").run(id)
  if (!res.changes) throw notFound("Token nicht gefunden.")
}

/** `Authorization: Bearer dft_…` → token id, or null. */
export function authenticateBearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "")
  if (!m || !m[1].startsWith(TOKEN_PREFIX)) return null
  const row = db()
    .prepare("SELECT id FROM api_tokens WHERE token_hash = ?")
    .get(hashToken(m[1])) as { id: string } | undefined
  if (!row) return null
  db()
    .prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
    .run(now(), row.id)
  return row.id
}

// ---------- upload tickets ----------

export interface TicketTarget {
  project: string
  draft: string
  /** Set → replace this page's HTML (threads kept); unset → new page. */
  pageId?: string
  name?: string
  display?: string
  designWidth?: number
  paperFileId?: string
  paperNodeId?: string
}

export function createUploadTicket(
  tokenId: string,
  target: TicketTarget
): { ticket: string; expiresAt: string } {
  const d = requireDraft(target.project, target.draft)
  if (target.pageId) {
    const page = db()
      .prepare("SELECT id FROM pages WHERE id = ? AND draft_id = ?")
      .get(target.pageId, d.id)
    if (!page) throw notFound("Seite nicht gefunden.")
  }
  const ticket = randomBytes(24).toString("base64url")
  const expiresAt = new Date(Date.now() + TICKET_MINUTES * 60_000).toISOString()
  db()
    .prepare(
      "INSERT INTO upload_tickets (id, token_id, draft_id, page_id, name, display, design_width, paper_file_id, paper_node_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      hashToken(ticket),
      tokenId,
      d.id,
      target.pageId ?? null,
      target.name ?? null,
      target.display ?? null,
      target.designWidth ?? null,
      target.paperFileId ?? null,
      target.paperNodeId ?? null,
      expiresAt
    )
  // Expired tickets are never consumed; sweep them as new ones are made.
  db().prepare("DELETE FROM upload_tickets WHERE expires_at < ?").run(now())
  return { ticket, expiresAt }
}

/** 401 unless the ticket exists and has not expired: checked before the
 *  upload body is read. */
export function requireUploadTicket(ticket: string): void {
  const row = db()
    .prepare("SELECT expires_at FROM upload_tickets WHERE id = ?")
    .get(hashToken(ticket)) as { expires_at: string } | undefined
  if (!row || Date.parse(row.expires_at) < Date.now()) throw invalidTicket()
}

const invalidTicket = () =>
  new HttpError(
    401,
    "Upload-Link ungültig oder abgelaufen. Bitte einen neuen anfordern."
  )

/** Runs the upload for a valid ticket and spends the ticket only when it
 *  succeeds, so a rejected file (say, a leftover external URL) can be fixed
 *  and sent again on the same link until it expires. */
export function withUploadTicket<T>(
  ticket: string,
  upload: (target: {
    project: string
    draft: string
    pageId: string | null
    defaults: Omit<PageInput, "html" | "fileName">
  }) => T
): T {
  const id = hashToken(ticket)
  const row = db()
    .prepare(
      `SELECT t.page_id, t.name, t.display, t.design_width, t.paper_file_id,
        t.paper_node_id, t.expires_at,
        d.slug AS draft_slug, p.slug AS project_slug
       FROM upload_tickets t JOIN drafts d ON d.id = t.draft_id JOIN projects p ON p.id = d.project_id
       WHERE t.id = ?`
    )
    .get(id) as
    | {
        page_id: string | null
        name: string | null
        display: string | null
        design_width: number | null
        paper_file_id: string | null
        paper_node_id: string | null
        expires_at: string
        draft_slug: string
        project_slug: string
      }
    | undefined
  if (!row || Date.parse(row.expires_at) < Date.now()) throw invalidTicket()
  const result = upload({
    project: row.project_slug,
    draft: row.draft_slug,
    pageId: row.page_id,
    defaults: {
      name: row.name ?? undefined,
      display: row.display ?? undefined,
      designWidth: row.design_width ?? undefined,
      paperFileId: row.paper_file_id ?? undefined,
      paperNodeId: row.paper_node_id ?? undefined,
    },
  })
  db().prepare("DELETE FROM upload_tickets WHERE id = ?").run(id)
  return result
}
