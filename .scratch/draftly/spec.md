# Draftly MVP

**Status:** ready-for-agent

Self-hosted HTML review: operator uploads pages, reviewer comments without an account.

## Problem Statement

The operator needs to show website drafts to a reviewer and collect pinned comments. Existing design tools require the reviewer to create an account. Bitmap and PDF reviews look soft, load slowly on tall pages, or feel like a document instead of a site. The operator already has a VPS and does not want a SaaS holding unpublished work.

## Solution

Draftly is a single-operator app at `https://draftly.mchlr.de`. The operator logs in at `/admin`, groups work into projects, and shares a draft at `/<project-slug>/<draft-slug>` with a generated password. Each draft holds one or more self-contained HTML pages. The reviewer opens the link, types the password and a display name, and pins comments on the page they are looking at. New comments appear for everyone who has the draft open, within two seconds. Pages sit in a sandboxed iframe so the chrome never inherits their CSS. Fixed-width pages keep their design size (scale down to fit a narrower window, letterbox when the window is wider). Fill-width pages use the viewer width and are not scaled up from a fixed layout.

## User Stories

1. As an operator, I want to open `/admin` and sign in with one password, so that only I can create and change drafts.
2. As an operator, I want that sign-in to last as a session cookie, so that I do not re-enter the password on every click.
3. As an operator, I want to create a project with a slug I choose, so that related drafts live under one name.
4. As an operator, I want to create a draft under a project with a slug I choose, so that the public URL is something I can say out loud.
5. As an operator, I want Draftly to generate the draft password, so that I do not invent weak ones.
6. As an operator, I want to see the draft password once at creation, so that I can send it to the reviewer.
7. As an operator, I want to rotate a draft password, so that a leaked or forgotten password can be replaced.
8. As an operator, I want each draft to have its own password, so that a reviewer who knows `v4` cannot open `v5` by guessing the slug.
9. As an operator, I want to copy the full draft URL and password from the admin, so that I can paste them into WhatsApp.
10. As an operator, I want to set the letterbox colour on a draft, so that the bands around a fixed page match the design.
11. As an operator, I want to upload a self-contained HTML file as a page, so that the reviewer sees typography and layout, not a screenshot.
12. As an operator, I want to name the page at upload, so that the reviewer can tell pages apart.
13. As an operator, I want to choose fixed or fill display at upload, so that Paper layouts stay true-size and other HTML can go full width.
14. As an operator, I want to set the design width for a fixed page (default 1440), so that letterboxing and scaling use the right number.
15. As an operator, I want an upload with any `http(s)` URL in it to be rejected, so that pages cannot depend on Paper's CDN or other live assets.
16. As an operator, I want to upload several pages into one draft, so that a site review is one link, not one link per screen.
17. As an operator, I want to reorder pages, so that the switcher matches the intended tour.
18. As an operator, I want to replace a page's HTML, so that I can fix the design without making a new draft.
19. As an operator, I want existing threads to remain when I replace a page, so that reviewer comments are not silently destroyed.
20. As an operator, I want to delete a page and have its threads go with it, so that I can drop a screen on purpose.
21. As an operator, I want to delete a draft, so that an old share dies.
22. As an operator, I want to delete a project only when it has no drafts, or with an explicit confirm that drafts go too, so that I do not wipe a live link by accident.
23. As an operator, I want to open a draft URL while signed in at `/admin` and skip the password gate, so that I can check the review without the reviewer secret.
24. As an operator, I want resolve and delete controls on threads when I am in that signed-in session, so that I can close feedback.
25. As an operator, I want to see every project and draft in `/admin`, so that I do not keep a side list.
26. As a reviewer, I want to open a draft URL without creating an account, so that commenting has no signup.
27. As a reviewer, I want a wrong or missing URL to look like 404, so that I cannot tell whether a slug exists unless I have the full path and password.
28. As a reviewer, I want `/<project-slug>` with no draft to be 404, so that there is no public table of contents.
29. As a reviewer, I want to be asked for the draft password before I see any HTML or comments, so that unpublished work stays closed.
30. As a reviewer, I want a wrong password to fail without revealing whether the draft exists beyond the URL I already typed.
31. As a reviewer, I want to type a display name together with the password at the password gate, so that the operator can tell people apart and I am never interrupted while commenting.
32. As a reviewer, I want that name remembered in this browser, so that I do not type it again on the next visit or on any pin.
33. As a reviewer, I want to click the page and leave a pin with a first comment, so that feedback sits on the thing I mean.
34. As a reviewer, I want pins to stay on the same spot in the design after reload, window resize, and zoom, so that I trust the overlay.
35. As a reviewer, I want to reply in a thread, so that a pin can become a short conversation.
36. As a reviewer, I want to edit or delete a comment I wrote in this browser, so that typos are not permanent.
37. As a reviewer, I want not to edit or delete someone else's comment, so that feedback is not silently rewritten.
38. As a reviewer, I want to see all threads for the current page in a sidebar, so that I can scan without hunting pins.
39. As a reviewer, I want to filter the sidebar to open or resolved, so that done items get out of the way.
40. As a reviewer, I want clicking a pin or a sidebar row to open that thread, so that list and overlay stay in sync.
41. As a reviewer, I want to switch pages inside the draft, so that one password covers the whole site walkthrough.
42. As a reviewer, I want pins on page A to stay off page B, so that comments do not leak across screens.
43. As a reviewer, I want a fixed page never to grow wider than its design width, so that a Paper layout still looks like itself.
44. As a reviewer, I want a fixed page to scale down evenly when my window is narrower than the design, so that I do not scroll sideways.
45. As a reviewer, I want letterbox bands when my window is wider than a fixed page, in the draft's letterbox colour, so that the leftover space is intentional.
46. As a reviewer, I want a fill page to use the viewer width without scaling a fixed layout up, so that “fill” is not a zoom.
47. As a reviewer, I want the uploaded HTML not to run scripts and not to restyle the Draftly chrome, so that a page cannot take over the tool.
48. As a reviewer, I want a comment I post to show up in another open browser on the same draft within two seconds, so that a call stays in sync.
49. As a reviewer, I want replies, edits, deletes, and resolve/reopen to show up the same way, so that I do not reload to see status.
50. As a reviewer, I do not want live cursors or a presence list, so that the tool stays a comment overlay, not a whiteboard.
51. As a reviewer, I want my own comments editable after a reconnect, as long as this browser still has the same `clientId`, so that a dropped stream does not steal my identity.
52. As an operator, I want `/admin` and `/api` reserved, so that a project cannot be slugged `admin`.
53. As an operator, I want drafts unreachable from search engines (`noindex`), so that unpublished HTML is not indexed.
54. As an operator, I want rate limits on password guesses and on posting comments, so that a shared link cannot be trivially flooded.
55. As an operator, I want comments stored as text and rendered as text, so that a reviewer cannot inject HTML.
56. As an operator, I want the app to keep comments across deploys, so that a ship does not wipe a review.
57. As an operator, I want to run Draftly in Docker on the existing VPS behind Traefik, so that `draftly.mchlr.de` gets HTTPS.
58. As an operator, I want a local Docker or Node run that uses SQLite, so that I can build without the VPS.
59. As an operator, I want a fixture HTML page (self-contained, from a real Paper export used only as a test file) so that upload and viewer can be tried without a client file.
60. As a reviewer, I want a signed-out session that is not the operator, so that I can be asked for the password even on the operator's machine (private window).

## Implementation Decisions

- One Node process serves admin HTML, reviewer HTML, the JSON API, uploaded pages, and the event stream. Frontend and API share the origin; no CORS.
- Persist with SQLite on a volume owned by this stack, not the Convex Postgres (ADR-0003).
- Host on the existing VPS with Docker and Traefik. Public hostname is `draftly.mchlr.de` (the operator's domain is `mchlr.de`, not `mchrl.de`).
- Public URL shape is `/<project-slug>/<draft-slug>`. Project-only URLs 404. Reserved first segments: `admin`, `api`.
- Reviewer auth is a generated password per draft, hashed at rest, plaintext shown once, afterwards only rotation (ADR-0002). After success, a draft-scoped cookie so they are not prompted every request.
- Operator auth is one password from the environment, session cookie, HTTP-only. While that cookie is present, draft URLs skip the password gate and show moderation controls. There is no `?admin=` query token.
- Pages are operator-uploaded HTML. The server rejects any file that contains `http:` or `https:` URLs (W3C namespace and DTD identifiers like `http://www.w3.org/2000/svg` aside — they are never fetched). Styles and images must already be inline. Draftly does not pack or fetch assets. There is no Paper bridge in the server (ADR-0001); agents convert Paper frames on their side with the shipped skill and upload over MCP (ADR-0004).
- The viewer loads the page in an iframe with sandbox and without scripts. An overlay captures clicks for pins. Coordinates are stored in design pixels relative to the page's top-left.
- Fixed display: never scale above 1. If the viewer is narrower than design width, scale uniformly to fit width and keep vertical scroll. If wider, centre the page and fill leftover bands with the draft letterbox colour. Fill display: iframe matches viewer content width; do not upscale a fixed layout.
- Iframe height is measured after load (same origin) from the page document.
- Threads belong to a page. Status is `open` or `resolved`. Comments belong to a thread, with `author_name`, `client_id`, body (plain text, max 5000 characters), timestamps, optional edited/deleted.
- Realtime is comment data only: thread created/updated/deleted, comment created/updated/deleted. Full objects on the event, not diffs. Target: visible on a second client in under two seconds. No presence, no cursors. Transport: server-sent events from the app, with reconnect that reloads the full snapshot. (WebSockets are available on the VPS but SSE matches write-via-REST.)
- After a stream drop, the client reconnects and GETs the full draft snapshot so it cannot miss events.
- The password gate asks for display name and password in one form. Both are required. The name is stored in `localStorage` next to the `clientId` and prefilled on the next visit; the comment composer never asks for it and shows who is commenting.
- Identity for “my comment”: a random `clientId` in `localStorage` plus the display name. Same browser can edit/delete own comments. Operator can delete any comment or thread and can resolve/reopen threads.
- Replacing a page keeps the page id and its threads. Deleting a page deletes its threads.
- Search engines: `X-Robots-Tag: noindex` on all responses.
- Rate-limit POSTs that guess passwords or create comments, per IP.
- Comment bodies are always escaped / set as text, never `innerHTML`.
- Test seam (agreed): the running HTTP app as an external client — admin flows, public flows, upload rejection, REST comments, and SSE. Do not test SQLite or framework internals. Overlay geometry is the same numbers as the API; no second seam for the iframe for MVP.
- UI language: German, matching reviewers.
- Visual design: Paper file [Draftly](https://app.paper.design/file/01M55CZKA33B8XBSH3S8MN3HW7). Implement to those artboards (Apple materials: Inter with optical sizing, translucent chrome, copper pins). German UI.

### Data (logical)

- projects: slug, title, created_at
- drafts: project, slug unique within project, password_hash, letterbox colour, created_at
- pages: draft, name, display mode (fixed | fill), design width, sort, HTML blob, created_at
- threads: page, x, y, status, created_at, resolved_at
- comments: thread, author_name, client_id, body, created_at, edited_at, deleted_at

### Public HTTP (illustrative)

All reviewer writes after the password cookie. Operator writes after the admin cookie.

- Operator: sign in, list/create/delete projects, list/create/rotate/delete drafts, list/upload/replace/reorder/delete pages
- Reviewer: GET draft snapshot (manifest + threads + comments) after password; POST thread; POST comment; PATCH/DELETE own comment; SSE subscribe
- Operator on a draft: PATCH thread status; DELETE thread or any comment

## Testing Decisions

- A good test describes a capability through the HTTP seam (“reviewer with the password sees the page, without it does not”). It does not open SQLite, stub the framework, or reimplement scaling maths in the assertion.
- Expected values are literals from this spec: 404 on project-only URLs, reject HTML that contains `https://`, pin x/y round-trip, second client receives the event.
- Cover: operator session, slug uniqueness and reserved names, password hash/rotate, upload accept/reject, page replace keeps threads, page delete drops threads, password gate, 404, comment CRUD ownership, resolve, SSE fan-out, `noindex`.
- There is no prior test suite; this repo is empty. First tests start the app (or the HTTP listener) in-process or on localhost.

## Out of Scope

- Accounts, OAuth, email or push notification
- Multiple operators or roles
- Paper (or any source) exporter running in the server (agents do it client-side, ADR-0004)
- PDF review surface
- Responsive uploaded pages; mobile-optimized chrome
- File attachments, @-mentions, live cursors, presence
- Version compare, comment-on-DOM-node
- Public project index or redirect from `/<project-slug>` to a “current” draft
- Shared hosting / Cloud Economy deploy
- Showing a draft password again after creation (rotate instead)

## Further Notes

- Fixture HTML for tests may be produced from Paper (`get_jsx` → static HTML, assets inlined). That script is not shipped to operators as a bridge.
- First real review target in the operator's head: Tanjas Wellness-Oase `v4` pages only (not the 380px keyword boards). That content is not required to close the MVP tickets; the fixture is.
- Original handoff assumed secret tokens, SSE-on-shared-hosting, and a Paper pipeline. Those are superseded by the ADRs in `docs/adr/`.
