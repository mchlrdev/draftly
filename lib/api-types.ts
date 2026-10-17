// Wire types shared by the HTTP API (app/api/**) and the UI.
// The contract behind them is .scratch/draftly/api-contract.md.

export type DisplayMode = "fixed" | "fill"
export type ThreadStatus = "open" | "resolved"

export interface Project {
  slug: string
  title: string
  createdAt: string
  drafts: DraftSummary[]
}

export interface DraftSummary {
  slug: string
  projectSlug: string
  letterbox: string
  createdAt: string
  pageCount: number
  openThreadCount: number
}

export interface Page {
  id: string
  name: string
  display: DisplayMode
  designWidth: number
  sort: number
  createdAt: string
  updatedAt: string
}

export interface Draft extends DraftSummary {
  projectTitle: string
  pages: Page[]
}

export interface Comment {
  id: string
  threadId: string
  authorName: string
  /** Lowercase hex SHA-256 of the author's clientId. The client hashes its own
   *  clientId to recognise "mine"; the raw clientId is never sent out. */
  authorKey: string
  /** Plain text. Empty once deleted. */
  body: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export interface Thread {
  id: string
  pageId: string
  /** Design pixels from the page's top-left. */
  x: number
  y: number
  status: ThreadStatus
  createdAt: string
  resolvedAt: string | null
  /** Oldest first. */
  comments: Comment[]
}

/** GET /api/d/:project/:draft */
export interface DraftSnapshot {
  draft: Draft
  threads: Thread[]
  /** True when the request carries the operator session. */
  operator: boolean
  /** The name the operator set in /admin; null when unset or not operator. */
  operatorName: string | null
}

/** One message on GET /api/d/:project/:draft/events (SSE `event:` name + JSON `data:`). */
export type DraftEvent =
  | { type: "thread.created"; thread: Thread }
  | { type: "thread.updated"; thread: Thread }
  | { type: "thread.deleted"; threadId: string; pageId: string }
  | { type: "comment.created"; comment: Comment }
  | { type: "comment.updated"; comment: Comment }
  | { type: "comment.deleted"; comment: Comment }

export interface ApiError {
  error: string
}

export const MAX_COMMENT_LENGTH = 5000
export const DEFAULT_DESIGN_WIDTH = 1440
export const DEFAULT_LETTERBOX = "#D8D2C8"
export const RESERVED_SLUGS = ["admin", "api", "_next"] as const
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
