# Agents upload pages over MCP; the Paper conversion runs on the agent's side

The operator should not export Paper frames by hand. Draftly exposes a Streamable HTTP MCP server at `/api/mcp` for agents such as Claude Code, and ships the "Paper → Draftly" skill with it: as the MCP prompt and resource `paper-to-draftly`, and as a SKILL.md download. The conversion itself (Paper `get_jsx` → self-contained HTML, images and Google fonts inlined) is a dependency-free script the agent downloads from `/agent/paper-to-html.mjs` and runs locally. Paper's MCP server only exists on the operator's machine, next to the Paper app, so the server cannot fetch Paper. Draftly still only accepts self-contained HTML and stays source-agnostic (ADR 0001): the bridge is an agent recipe, not a server feature.

Agents authenticate with API tokens the operator creates in the "Agenten" dialog: `dft_` plus 32 random bytes, stored as a SHA-256 hash (see the amendment below), revocable one by one. A token can use the MCP tools only. It cannot manage tokens or settings, and no tool deletes anything. OAuth was rejected: there is one operator and no third-party clients, and a pasted bearer header is what agent CLIs support today.

Large pages do not go through a tool call: base64 images would cost the model the whole file in tokens. `prepare_page_upload` returns a one-time upload link (random ticket, hashed at rest, 30 minutes, tied to the token and the draft, optionally to the page it replaces). The converter, or `curl -F file=@page.html`, posts the file there, so the token itself never has to be in the shell. A rejected upload does not spend the link; the first successful one does. Revoking the token voids its links.

This supersedes the spec's "no Paper bridge in the product" and "Paper exporter as a product feature" out-of-scope line, in this narrower form.

## Amendment (2026-10-29): the operator can read tokens again

"Shown once" made the operator create a new token whenever they set up another agent or lost the snippet, and the setup instructions vanished with the one-time view. Tokens are now also stored encrypted, with the same AES-256-GCM scheme as draft passwords (ADR 0002 amendment, AAD `api-token:<id>`). The signed-in operator reads them through `GET /api/admin/tokens/:id`, and the "Agenten" dialog always shows the setup for Claude Code, Cursor and other agents, filled in with the selected token. The bearer check still uses the hash. Tokens created before this change have no encrypted copy; the dialog says so, and the operator replaces them.

## Amendment (2026-10-29): agents work through comments; pages remember their Paper artboard

Agents read review threads (`list_comments`), reply, place pins and resolve or reopen threads. Their comments carry the operator's name with " (Agent)", so a reviewer can tell them from the operator's own; the agent's identity for "own comments" is `agent:<token id>`, which never leaves the server. Deleting still stays with the operator.

To get from a pin back to the design, a page may record the Paper file id and artboard node id it was made from (`pages.paper_file_id`, `paper_node_id`). They come from `<meta name="paper:file">` / `<meta name="paper:node">` in the uploaded HTML (the converter writes them), from the upload form, or from MCP. Pages from before stay without and work as they did. Pin coordinates are design pixels from the page's top-left, the same space as the artboard, so the agent finds the element with Paper's own tools.

## Amendment (2026-10-29): server-side screenshots

Agents also need to see pages without a Paper link, and placing a pin from a picture is easier than from a node tree. `get_page_screenshot` and `get_thread_screenshot` render the stored HTML with a headless Chromium shell (playwright-core, `chromium-headless-shell` in the image) and return a JPEG with pins drawn and numbered as in the viewer. No library renders arbitrary HTML/CSS faithfully enough for pins to land right: Satori/resvg handle a CSS subset with their own text layout, wkhtmltoimage is an unmaintained old WebKit. The shell adds about 100–130 MB to the image and runs only on demand: one page at a time, closed after a minute idle. The page gets no JavaScript and no network (only `data:` URLs load), so uploaded HTML cannot reach anything from the server. Pins are positioned divs added to the HTML before rendering.
