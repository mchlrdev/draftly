# Draftly HTTP contract

**Status:** agreed — the seam between backend and UI. Types live in `lib/api-types.ts`.

All JSON. Errors are `{ "error": "<German, user-facing message>" }` with the status below. Every response carries `X-Robots-Tag: noindex`.

## Config (env)

- `ADMIN_PASSWORD` — operator password (required; dev fallback `draftly` only when `NODE_ENV !== "production"`).
- `DRAFTLY_DATA_DIR` — directory holding `draftly.sqlite` (default `./data`, git-ignored).
- `DRAFTLY_PUBLIC_ORIGIN` — origin shown in copied links (default: request origin).

## Cookies

- `draftly_admin` — HTTP-only, SameSite=Lax, session cookie. Opaque random token stored server-side.
- `draftly_d_<draftId>` — HTTP-only, SameSite=Lax, path `/`. Proves the draft password. Stops working after rotation.

## Operator (`/api/admin/**`, need `draftly_admin` except login → else 401)

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/admin/login` | `{ password }` | 204 + cookie. Wrong → 401. Rate-limited per IP (429). |
| POST | `/api/admin/logout` | — | 204, cookie cleared |
| GET | `/api/admin/session` | — | 200 `{ operator: boolean }` (never 401) |
| GET | `/api/admin/settings` | — | 200 `{ operatorName: string \| null }` |
| PUT | `/api/admin/settings` | `{ operatorName }` | 200 `{ operatorName: string \| null }`. Trimmed; empty → null; > 60 chars → 422 |
| GET | `/api/admin/projects` | — | 200 `Project[]` (drafts included, newest first) |
| POST | `/api/admin/projects` | `{ slug, title? }` | 201 `Project`. Bad/reserved slug → 422, duplicate → 409 |
| PATCH | `/api/admin/projects/:project` | `{ title?, slug? }` | 200 `Project`. Slug rules as on create (422), taken → 409. Empty title → slug. Draft URLs move with the slug; reviewer cookies keep working |
| DELETE | `/api/admin/projects/:project` | `?force=1` | 204. Has drafts and no force → 409 |
| POST | `/api/admin/projects/:project/drafts` | `{ slug, letterbox? }` | 201 `{ draft: Draft, password }` |
| GET | `/api/admin/projects/:project/drafts/:draft` | — | 200 `Draft` |
| PATCH | `/api/admin/projects/:project/drafts/:draft` | `{ letterbox?, slug? }` (`#RRGGBB`) | 200 `Draft`. Slug taken in the project → 409. A new slug changes the public URL; reviewer cookies keep working |
| GET | `/api/admin/projects/:project/drafts/:draft/password` | — | 200 `{ password: string \| null }` — null for drafts created before the password was stored (rotate once) |
| POST | `/api/admin/projects/:project/drafts/:draft/rotate` | — | 200 `{ password }`. Ends the draft's open event streams |
| DELETE | `/api/admin/projects/:project/drafts/:draft` | — | 204. Ends the draft's open event streams |
| POST | `/api/admin/projects/:project/drafts/:draft/pages` | multipart: `file`, `name`, `display` (`fixed`\|`fill`), `designWidth` (default 1440) | 201 `Page`. Contains `http:`/`https:` → 422 |
| PUT | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | multipart: `file` (+ optional `name`, `display`, `designWidth`) | 200 `Page` — same id, threads kept |
| PATCH | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | `{ name?, display?, designWidth? }` | 200 `Page` |
| PUT | `/api/admin/projects/:project/drafts/:draft/pages` | `{ order: pageId[] }` | 200 `Page[]` |
| DELETE | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | — | 204, threads deleted (one `thread.deleted` event each) |

| GET | `/api/admin/tokens` | — | 200 `ApiToken[]` (newest first; never the token itself) |
| POST | `/api/admin/tokens` | `{ name }` | 201 `{ token, apiToken }`. Token shown once. Empty or > 60 chars → 422 |
| DELETE | `/api/admin/tokens/:tokenId` | — | 204, its upload links die too. Unknown → 404 |
| GET | `/api/admin/agent/skill` | — | 200 `text/markdown` attachment: the `paper-to-draftly` SKILL.md |

Token routes need the operator cookie; a bearer token gets 401 there.

Draft passwords (ADR 0002 amendment): stored as a scrypt hash (reviewer check) plus an AES-256-GCM copy (`drafts.password_enc`, key = HKDF-SHA256 of the server secret, AAD = draft id) that only the operator can read via `GET …/password`.

Unknown project/draft/page → 404. Slugs match `SLUG_PATTERN`; project slugs not in `RESERVED_SLUGS`.

## Reviewer (`/api/d/:project/:draft/**`)

Access = valid `draftly_d_<id>` cookie **or** operator session. Without access → 401 (same body whether or not the draft exists). Unknown draft with access impossible → 404 only for operator.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/d/:project/:draft/unlock` | `{ password }` | 204 + cookie. Wrong or unknown draft → 401 `{error:"Passwort stimmt nicht."}`. Rate-limited per IP (429). |
| GET | `/api/d/:project/:draft` | — | 200 `DraftSnapshot` (`operatorName` = the name from `/api/admin/settings` for the operator, else null) |
| GET | `/api/d/:project/:draft/pages/:pageId/html` | — | 200 `text/html`, headers `Content-Security-Policy: script-src 'none'; frame-ancestors 'self'`, `X-Content-Type-Options: nosniff` |
| POST | `/api/d/:project/:draft/threads` | `{ pageId, x, y, body, authorName, clientId }` | 201 `Thread` (with first comment). Rate-limited (429) |
| POST | `/api/d/:project/:draft/threads/:threadId/comments` | `{ body, authorName, clientId }` | 201 `Comment`. Rate-limited (429) |
| PATCH | `/api/d/:project/:draft/comments/:commentId` | `{ body, clientId }` | 200 `Comment`. Other clientId → 403 |
| DELETE | `/api/d/:project/:draft/comments/:commentId` | `{ clientId }` | 200 `Comment` (soft delete: `deletedAt` set, `body` ""). Other clientId and not operator → 403 |
| PATCH | `/api/d/:project/:draft/threads/:threadId` | `{ status }` | 200 `Thread`. Operator only → else 403 |
| DELETE | `/api/d/:project/:draft/threads/:threadId` | — | 204. Operator only → else 403 |
| GET | `/api/d/:project/:draft/events` | — | `text/event-stream`. Each message: `event: <DraftEvent.type>` + `data: <DraftEvent JSON>`. Comment `: ping` every 15 s. The server ends the stream when the draft's password is rotated or the draft is deleted; the client reconnects, and its snapshot reload answers 401/404. |

Body is plain text, 1–5000 chars after trim (else 422). `authorName` 1–60 chars after trim. `x`, `y` finite numbers ≥ 0.

`clientId` is a random id per browser and the credential for editing/deleting own comments. Requests send it raw; responses, snapshots and events never contain it. Each `Comment` carries `authorKey` = lowercase hex SHA-256 of its author's clientId instead; the client hashes its own clientId to recognise its comments.

Rate limits key on the client IP = the **last** `X-Forwarded-For` entry (appended by the one trusted proxy, Traefik), else `local`.

## Agents (ADR 0004)

| Method | Path | Auth | Success |
|---|---|---|---|
| POST | `/api/mcp` | `Authorization: Bearer dft_…` (else 401 + `WWW-Authenticate: Bearer`) | MCP Streamable HTTP, stateless, JSON responses. GET/DELETE → 405 |
| POST | `/api/agent/upload/:ticket` | the ticket | Multipart as the operator upload (`file`, optional `name`, `display`, `designWidth` overriding the link's). New page → 201 `Page`; replace → 200 `Page`. Unknown, expired or spent → 401. A 4xx from validation does not spend the link |
| GET | `/agent/paper-to-html.mjs` | public | The converter script (static file) |

MCP tools: `list_projects`, `create_project`, `create_draft`, `get_draft` (link, password, pages), `prepare_page_upload` (→ `uploadUrl`, 30 min), `upload_page` (inline HTML, small pages only), `reorder_pages`. Prompt and resource: `paper-to-draftly` (`draftly://skill/paper-to-draftly`). Domain errors come back as tool results with `isError` and the German message. Links use `DRAFTLY_PUBLIC_ORIGIN`, else the request's host.

## Pages (UI routes)

- `/` → 404. `/admin` → login, or an empty state pointing at the sidebar (the sidebar lists projects and their drafts). `/admin/[project]` → project (its drafts). `/admin/[project]/[draft]` → draft.
- `/<project>` → 404. `/<project>/<draft>` → gate (no access) or viewer. Unknown draft → 404 page (artboard "404").
- All UI text German.
