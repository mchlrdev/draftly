// The "Paper → Draftly" skill (ADR 0004). One text, three ways out: the MCP
// prompt and resource, and the SKILL.md download in the operator's agent
// dialog. The origin is filled in so the converter URL works as written.

export const SKILL_NAME = "paper-to-draftly"

export const SKILL_DESCRIPTION =
  "Turn Paper artboards into self-contained HTML pages and upload them to a Draftly draft for review, and work through the review comments on Draftly. Use when the user wants Paper frames on Draftly, wants to update pages there, or asks what reviewers said and wants the feedback handled."

export function skillMarkdown(origin: string, { frontmatter = false } = {}) {
  const body = `# Paper → Draftly

Turn Paper artboards into Draftly pages without the operator exporting anything by hand. You need two MCP servers: **Paper** (the Paper desktop app with the file open) and **Draftly** (this server, with an API token).

Draftly only accepts self-contained HTML: no \`http:\`/\`https:\` URLs (W3C namespace ids aside), max 25 MB. Images and fonts must be inlined. The converter below does that. Don't hand-write or hand-edit the HTML.

## 1. Pick the frames

1. Paper \`get_basic_info\`: the artboards on the page, with name, width and height. Use \`pageId\` for another Paper page.
2. Take the artboards the user named. If they named none, use the current selection (\`get_selection\`). If nothing is selected, ask. Variants and scratch boards ("Variante", "Copy", "WIP") are only uploaded when asked for.
3. One artboard is one Draftly page. Page name = artboard name. Display \`fixed\` with design width = artboard width, unless the user wants \`fill\`.

## 2. Pick the draft

1. Draftly \`list_projects\`. Reuse the project and draft the user means. Otherwise \`create_project\` / \`create_draft\` with short lowercase slugs (\`kunde\`, \`website-v2\`).
2. \`get_draft\` lists the pages already there. If a page has the same name as an artboard, **replace** it (pass its \`pageId\`): the HTML is swapped and the reviewers' comments stay. Otherwise add a new page.

## 3. Convert and upload, per artboard

Work in a scratch folder, e.g. \`/tmp/draftly-<draft>/\`.

1. Once: download the converter (Node 18+, no dependencies):
   \`curl -fsSL ${origin}/agent/paper-to-html.mjs -o paper-to-html.mjs\`
2. Once: Paper \`get_tokens\` with \`format: "css"\`. Write the \`:root { … }\` block to \`tokens.css\`.
3. Paper \`get_jsx\` for the artboard with \`includeNodeIds: false\` and the default inline styles. Write the result to \`<slug>.jsx\` **verbatim**: every character, the file header line included. Do not reformat, shorten or "fix" it.
4. Draftly \`prepare_page_upload\` with \`project\`, \`draft\`, \`name\`, \`display\`, \`designWidth\` (and \`pageId\` to replace). It returns a one-time \`uploadUrl\`, valid 30 minutes.
5. Run:
   \`node paper-to-html.mjs <slug>.jsx --tokens tokens.css --out <slug>.html --title "<name>" --paper-node <artboard node id> --upload "<uploadUrl>"\`
   It inlines every image (shrunk with \`sips\` on macOS) and the Google fonts the page uses, checks for leftover URLs and the size limit, then uploads. The last line is the created page as JSON.
   \`--paper-node\` (and the file id it reads from the \`get_jsx\` header) go into the HTML as \`<meta name="paper:file">\` / \`<meta name="paper:node">\`. Draftly stores them on the page, so later feedback leads straight back to the artboard. Always pass it.

The upload link is a credential for one page. Do not print it to the user, and never put the API token in the shell.

Several artboards: run steps 3 to 5 for each one. If the order matters, finish with \`reorder_pages\` (all page ids, in order).

## 4. Report

Give the user the draft link and the password from \`get_draft\` (or \`create_draft\`), and the page names you added or replaced. If you replaced pages, mention that existing comments stayed.

## 5. Work through feedback

Reviewers pin comments onto pages. Each thread has a page, a status and x/y in **design pixels from the page's top-left**. For a page made from Paper that is the same coordinate system as its artboard.

1. Draftly \`list_comments\` (default: open threads; \`since\` for only what is new). Pages carry \`paper: { fileId, nodeId }\` when Draftly knows where they came from.
2. For each thread, find what it points at:
   - With a Paper link: Paper \`get_screenshot\` of that artboard (\`nodeId\`), and \`get_tree_summary\` / \`get_node_info\` to find the element whose box contains x/y (child positions are relative to the artboard). Look at the region around the pin before you decide.
   - Without one, or when a rendered view is quicker: Draftly \`get_thread_screenshot\` shows the area around the pin (ringed in red) as the reviewer sees it. \`get_page_screenshot\` renders a slice of a page with all pins numbered; page through with \`top\`. To change the design, match the page name to an artboard (\`get_basic_info\`), or ask the user.
3. Sum up the feedback for the user first, grouped by page, with what you would change. Change the design only when the user asked you to.
4. After changing an artboard in Paper, upload it again **replacing** its page (\`pageId\` in \`prepare_page_upload\`, steps 3 to 5): comments stay on the page.
5. \`reply_to_thread\` saying briefly what changed, then \`set_thread_status\` \`resolved\`. Leave threads open that you did not fully handle, and say why in the reply. Replies show to reviewers live as "<operator> (Agent)", so write as you would to the client: short, German if they wrote German.
6. \`create_thread\` places your own pin (x/y in design pixels), e.g. to ask the reviewer a question about a spot. Use it sparingly. From a screenshot, design x/y = \`shown.x + px / imageScale\`, \`shown.y + py / imageScale\`.

Pin numbers in \`list_comments\` and the screenshots are the ones reviewers see in the viewer ("Pin 3 on Home").

After an upload, \`get_page_screenshot\` is a quick check that the page looks like the artboard.

Never resolve threads you only read. Never reply to a reviewer without the user knowing what you will say, unless they told you to handle the feedback on your own.

## When something fails

- **"external URL(s) left"**: usually an image the converter could not download, or a \`paper-gen://\` image still generating. Wait, run \`get_jsx\` again, and retry. A failed upload does not use up the link.
- **Font "X" is not on Google Fonts**: Paper \`get_font_family_info\` shows where it comes from. Find the file (often \`~/Library/Fonts\`) and pass \`--font "X:400=/path/X-Regular.woff2"\` (one per weight, add \`italic\` like \`700italic\`). Otherwise the page falls back to another font. Say so in your report.
- **Larger than 25 MB**: rerun with \`--max-image 1600 --jpeg-quality 72\`.
- **401 on upload**: the link expired or was already used for a successful upload. Call \`prepare_page_upload\` again.
- **422 from Draftly**: the message says what is wrong (German). Fix the input. Do not loop on the same file.
- **Converter parse error**: the JSX file was not saved verbatim. Write it again from the \`get_jsx\` result.
`
  if (!frontmatter) return body
  return `---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---

${body}`
}
