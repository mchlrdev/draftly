# Agents upload pages over MCP; the Paper conversion runs on the agent's side

The operator should not export Paper frames by hand. Draftly exposes a Streamable HTTP MCP server at `/api/mcp` for agents such as Claude Code, and ships the "Paper → Draftly" skill with it: as the MCP prompt and resource `paper-to-draftly`, and as a SKILL.md download. The conversion itself (Paper `get_jsx` → self-contained HTML, images and Google fonts inlined) is a dependency-free script the agent downloads from `/agent/paper-to-html.mjs` and runs locally. Paper's MCP server only exists on the operator's machine, next to the Paper app, so the server cannot fetch Paper. Draftly still only accepts self-contained HTML and stays source-agnostic (ADR 0001): the bridge is an agent recipe, not a server feature.

Agents authenticate with API tokens the operator creates in the "Agenten" dialog: `dft_` plus 32 random bytes, stored as a SHA-256 hash (see the amendment below), revocable one by one. A token can use the MCP tools only. It cannot manage tokens or settings, and no tool deletes anything. OAuth was rejected: there is one operator and no third-party clients, and a pasted bearer header is what agent CLIs support today.

Large pages do not go through a tool call: base64 images would cost the model the whole file in tokens. `prepare_page_upload` returns a one-time upload link (random ticket, hashed at rest, 30 minutes, tied to the token and the draft, optionally to the page it replaces). The converter, or `curl -F file=@page.html`, posts the file there, so the token itself never has to be in the shell. A rejected upload does not spend the link; the first successful one does. Revoking the token voids its links.

This supersedes the spec's "no Paper bridge in the product" and "Paper exporter as a product feature" out-of-scope line, in this narrower form.

## Amendment (2026-10-29): the operator can read tokens again

"Shown once" made the operator create a new token whenever they set up another agent or lost the snippet, and the setup instructions vanished with the one-time view. Tokens are now also stored encrypted, with the same AES-256-GCM scheme as draft passwords (ADR 0002 amendment, AAD `api-token:<id>`). The signed-in operator reads them through `GET /api/admin/tokens/:id`, and the "Agenten" dialog always shows the setup for Claude Code, Cursor and other agents, filled in with the selected token. The bearer check still uses the hash. Tokens created before this change have no encrypted copy; the dialog says so, and the operator replaces them.
