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
| GET | `/api/admin/projects` | — | 200 `Project[]` (drafts included, newest first) |
| POST | `/api/admin/projects` | `{ slug, title? }` | 201 `Project`. Bad/reserved slug → 422, duplicate → 409 |
| DELETE | `/api/admin/projects/:project` | `?force=1` | 204. Has drafts and no force → 409 |
| POST | `/api/admin/projects/:project/drafts` | `{ slug, letterbox? }` | 201 `{ draft: Draft, password }` — the only time plaintext is returned |
| GET | `/api/admin/projects/:project/drafts/:draft` | — | 200 `Draft` |
| PATCH | `/api/admin/projects/:project/drafts/:draft` | `{ letterbox }` (`#RRGGBB`) | 200 `Draft` |
| POST | `/api/admin/projects/:project/drafts/:draft/rotate` | — | 200 `{ password }` |
| DELETE | `/api/admin/projects/:project/drafts/:draft` | — | 204 |
| POST | `/api/admin/projects/:project/drafts/:draft/pages` | multipart: `file`, `name`, `display` (`fixed`\|`fill`), `designWidth` (default 1440) | 201 `Page`. Contains `http:`/`https:` → 422 |
| PUT | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | multipart: `file` (+ optional `name`, `display`, `designWidth`) | 200 `Page` — same id, threads kept |
| PATCH | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | `{ name?, display?, designWidth? }` | 200 `Page` |
| PUT | `/api/admin/projects/:project/drafts/:draft/pages` | `{ order: pageId[] }` | 200 `Page[]` |
| DELETE | `/api/admin/projects/:project/drafts/:draft/pages/:pageId` | — | 204, threads deleted |

Unknown project/draft/page → 404. Slugs match `SLUG_PATTERN`; project slugs not in `RESERVED_SLUGS`.

## Reviewer (`/api/d/:project/:draft/**`)

Access = valid `draftly_d_<id>` cookie **or** operator session. Without access → 401 (same body whether or not the draft exists). Unknown draft with access impossible → 404 only for operator.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/api/d/:project/:draft/unlock` | `{ password }` | 204 + cookie. Wrong or unknown draft → 401 `{error:"Passwort stimmt nicht."}`. Rate-limited per IP (429). |
| GET | `/api/d/:project/:draft` | — | 200 `DraftSnapshot` |
| GET | `/api/d/:project/:draft/pages/:pageId/html` | — | 200 `text/html`, headers `Content-Security-Policy: script-src 'none'; frame-ancestors 'self'`, `X-Content-Type-Options: nosniff` |
| POST | `/api/d/:project/:draft/threads` | `{ pageId, x, y, body, authorName, clientId }` | 201 `Thread` (with first comment). Rate-limited (429) |
| POST | `/api/d/:project/:draft/threads/:threadId/comments` | `{ body, authorName, clientId }` | 201 `Comment`. Rate-limited (429) |
| PATCH | `/api/d/:project/:draft/comments/:commentId` | `{ body, clientId }` | 200 `Comment`. Other clientId → 403 |
| DELETE | `/api/d/:project/:draft/comments/:commentId` | `{ clientId }` | 200 `Comment` (soft delete: `deletedAt` set, `body` ""). Other clientId and not operator → 403 |
| PATCH | `/api/d/:project/:draft/threads/:threadId` | `{ status }` | 200 `Thread`. Operator only → else 403 |
| DELETE | `/api/d/:project/:draft/threads/:threadId` | — | 204. Operator only → else 403 |
| GET | `/api/d/:project/:draft/events` | — | `text/event-stream`. Each message: `event: <DraftEvent.type>` + `data: <DraftEvent JSON>`. Comment `: ping` every 15 s. |

Body is plain text, 1–5000 chars after trim (else 422). `authorName` 1–60 chars after trim. `x`, `y` finite numbers ≥ 0.

## Pages (UI routes)

- `/` → 404. `/admin` → login or project list. `/admin/[project]` → project. `/admin/[project]/[draft]` → draft.
- `/<project>` → 404. `/<project>/<draft>` → gate (no access) or viewer. Unknown draft → 404 page (artboard "404").
- All UI text German.
