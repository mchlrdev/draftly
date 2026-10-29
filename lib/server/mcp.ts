import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { SKILL_DESCRIPTION, SKILL_NAME, skillMarkdown } from "@/lib/agent/skill"
import type { Draft, Thread } from "@/lib/api-types"
import {
  addComment,
  authorKey,
  createDraft,
  createPage,
  createProject,
  createThread,
  getOperatorName,
  listProjects,
  pageHtml,
  readPassword,
  reorderPages,
  replacePage,
  requireDraft,
  setThreadStatus,
  snapshot,
  toDraft,
  updatePage,
} from "./store"
import { notFound } from "./http"
import { MAX_CLIP_HEIGHT, screenshotPage, type PinMark } from "./screenshot"
import { createUploadTicket } from "./tokens"

// The MCP server behind /api/mcp (ADR 0004). Built fresh per request (the
// transport is stateless) for one authenticated token. Tools cover what an
// agent needs to put pages on a draft and to work through review comments;
// deleting stays with the operator.

const slug = z.string().describe("Slug as in the URL, e.g. `kunde`.")
const pageFields = {
  name: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Page name the reviewer sees. Use the artboard name."),
  display: z
    .enum(["fixed", "fill"])
    .optional()
    .describe(
      "`fixed` (default): shown at design width, scaled down on narrow screens. `fill`: as wide as the viewer."
    ),
  designWidth: z
    .number()
    .int()
    .min(200)
    .max(10000)
    .optional()
    .describe(
      "Design width in px for `fixed` pages (default 1440). Use the artboard width."
    ),
  paperFileId: z
    .string()
    .max(64)
    .optional()
    .describe(
      "Paper file id the page was made from (get_basic_info → file.id). The converter also writes it into the HTML."
    ),
  paperNodeId: z
    .string()
    .max(64)
    .optional()
    .describe("Paper artboard node id the page was made from, e.g. `1Y7-0`."),
}

const result = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

const imageResult = (jpeg: Buffer, data: unknown) => ({
  content: [
    {
      type: "image" as const,
      data: jpeg.toString("base64"),
      mimeType: "image/jpeg",
    },
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ],
})

/** Pin numbers as the viewer shows them: per page, oldest thread first. */
function pinNumbers(threads: Thread[]): Map<string, number> {
  const perPage = new Map<string, number>()
  const numbers = new Map<string, number>()
  const sorted = [...threads].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  for (const t of sorted) {
    const n = (perPage.get(t.pageId) ?? 0) + 1
    perPage.set(t.pageId, n)
    numbers.set(t.id, n)
  }
  return numbers
}

const COORDS =
  "Image pixel (px, py) is design point (shown.x + px / imageScale, shown.y + py / imageScale): use that for create_thread."

export function createMcpServer({
  tokenId,
  origin,
}: {
  tokenId: string
  origin: string
}) {
  const server = new McpServer(
    { name: "draftly", version: "1.0.0" },
    {
      instructions: `Draftly hosts HTML pages for client review: project → draft (one link + password) → pages. To put Paper artboards on a draft, follow the prompt "${SKILL_NAME}" (also the resource draftly://skill/${SKILL_NAME}): Paper get_jsx → ${origin}/agent/paper-to-html.mjs → prepare_page_upload. Pages must be self-contained HTML (no http/https URLs, max 25 MB). Review feedback: list_comments, then reply_to_thread / set_thread_status; the skill's section 5 covers going from a pin back to the Paper artboard.`,
    }
  )

  const draftInfo = (d: Draft) => ({
    url: `${origin}/${d.projectSlug}/${d.slug}`,
    project: d.projectSlug,
    draft: d.slug,
    password: readPassword(d.projectSlug, d.slug).password,
    openThreads: d.openThreadCount,
    pages: d.pages.map((p) => ({
      id: p.id,
      name: p.name,
      display: p.display,
      designWidth: p.designWidth,
      paper: p.paperNodeId
        ? { fileId: p.paperFileId, nodeId: p.paperNodeId }
        : null,
      updatedAt: p.updatedAt,
    })),
  })

  // Comments the agent writes go out under the operator's name, marked, so a
  // reviewer can tell them from the operator's own.
  const agentClientId = `agent:${tokenId}`
  const agentKey = authorKey(agentClientId)
  const agentName = () =>
    `${(getOperatorName() ?? "Draftly").slice(0, 52)} (Agent)`

  const threadInfo = (t: Thread, pageName: string, number?: number) => ({
    id: t.id,
    number,
    pageId: t.pageId,
    page: pageName,
    x: Math.round(t.x),
    y: Math.round(t.y),
    status: t.status,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt,
    comments: t.comments.map((c) => ({
      id: c.id,
      author: c.authorName,
      byYou: c.authorKey === agentKey,
      body: c.deletedAt ? null : c.body,
      deleted: Boolean(c.deletedAt),
      createdAt: c.createdAt,
      editedAt: c.editedAt,
    })),
  })

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description:
        "All projects with their drafts (slug, page count, open comment threads), newest first.",
      annotations: { readOnlyHint: true },
    },
    () =>
      result(
        listProjects().map((p) => ({
          project: p.slug,
          title: p.title,
          drafts: p.drafts.map((d) => ({
            draft: d.slug,
            url: `${origin}/${p.slug}/${d.slug}`,
            pages: d.pageCount,
            openThreads: d.openThreadCount,
          })),
        }))
      )
  )

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description:
        "A folder for drafts (operator-only, no public page). Slug: lowercase letters, digits, hyphens.",
      inputSchema: { slug, title: z.string().max(120).optional() },
    },
    ({ slug, title }) => {
      const p = createProject({ slug, title })
      return result({ project: p.slug, title: p.title })
    }
  )

  server.registerTool(
    "create_draft",
    {
      title: "Create draft",
      description:
        "A shareable draft in a project: its own link and generated password. Returns both.",
      inputSchema: {
        project: slug,
        slug,
        letterbox: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe("Colour of the bands beside fixed pages, `#RRGGBB`."),
      },
    },
    ({ project, slug, letterbox }) => {
      const { draft } = createDraft(project, { slug, letterbox })
      return result(draftInfo(draft))
    }
  )

  server.registerTool(
    "get_draft",
    {
      title: "Get draft",
      description:
        "A draft's link, password and pages (id, name, display, design width). Use the page ids to replace or reorder.",
      inputSchema: { project: slug, draft: slug },
      annotations: { readOnlyHint: true },
    },
    ({ project, draft }) =>
      result(draftInfo(toDraft(requireDraft(project, draft))))
  )

  server.registerTool(
    "prepare_page_upload",
    {
      title: "Prepare page upload",
      description:
        "A one-time upload link for one HTML file, valid 30 minutes. Send it with `node paper-to-html.mjs … --upload <url>` or `curl -F file=@page.html <url>`. With `pageId` the page's HTML is replaced and its comments stay; without, a new page is added. The link works until one upload succeeds. Don't show it to the user.",
      inputSchema: {
        project: slug,
        draft: slug,
        pageId: z
          .string()
          .optional()
          .describe("Replace this page instead of adding one."),
        ...pageFields,
      },
    },
    ({ project, draft, pageId, ...fields }) => {
      const { ticket, expiresAt } = createUploadTicket(tokenId, {
        project,
        draft,
        pageId,
        ...fields,
      })
      const uploadUrl = `${origin}/api/agent/upload/${ticket}`
      return result({
        uploadUrl,
        expiresAt,
        replaces: pageId ?? null,
        curl: `curl -fsS -F file=@page.html ${uploadUrl}`,
      })
    }
  )

  server.registerTool(
    "upload_page",
    {
      title: "Upload page (inline HTML)",
      description:
        "Upload a small self-contained HTML page passed as a string. For Paper artboards and anything with images, use prepare_page_upload and the converter instead: base64 images are too large to pass through a tool call.",
      inputSchema: {
        project: slug,
        draft: slug,
        html: z.string().min(1),
        pageId: z
          .string()
          .optional()
          .describe("Replace this page instead of adding one."),
        ...pageFields,
      },
    },
    ({ project, draft, html, pageId, ...fields }) => {
      const input = { html, ...fields }
      return result(
        pageId
          ? replacePage(project, draft, pageId, input)
          : createPage(project, draft, input)
      )
    }
  )

  server.registerTool(
    "reorder_pages",
    {
      title: "Reorder pages",
      description:
        "Set the page order of a draft. `order` must list every page id of the draft exactly once.",
      inputSchema: { project: slug, draft: slug, order: z.array(z.string()) },
    },
    ({ project, draft, order }) =>
      result(
        reorderPages(project, draft, order).map((p) => ({
          id: p.id,
          name: p.name,
        }))
      )
  )

  server.registerTool(
    "update_page",
    {
      title: "Update page",
      description:
        "Change a page's name, display, design width or Paper link without new HTML. An empty string clears a Paper id.",
      inputSchema: {
        project: slug,
        draft: slug,
        pageId: z.string(),
        ...pageFields,
      },
    },
    ({ project, draft, pageId, ...fields }) =>
      result(updatePage(project, draft, pageId, fields))
  )

  // ---------- comments ----------

  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      description:
        "Review threads of a draft with all their comments. Each thread is a pin on a page at x/y in design pixels from the page's top-left, the same coordinates as the Paper artboard (see the page's `paper` link). `byYou` marks comments this agent wrote.",
      inputSchema: {
        project: slug,
        draft: slug,
        status: z
          .enum(["open", "resolved", "all"])
          .optional()
          .describe("Default `open`."),
        pageId: z.string().optional().describe("Only this page."),
        since: z
          .string()
          .optional()
          .describe(
            "ISO time: only threads with a comment or status change after it."
          ),
      },
      annotations: { readOnlyHint: true },
    },
    ({ project, draft, status = "open", pageId, since }) => {
      const snap = snapshot(requireDraft(project, draft), true)
      const pages = new Map(snap.draft.pages.map((p) => [p.id, p]))
      const numbers = pinNumbers(snap.threads)
      const after = since ? Date.parse(since) : null
      const threads = snap.threads.filter((t) => {
        if (status !== "all" && t.status !== status) return false
        if (pageId && t.pageId !== pageId) return false
        if (after === null || Number.isNaN(after)) return true
        const times = [
          t.createdAt,
          t.resolvedAt,
          ...t.comments.flatMap((c) => [c.createdAt, c.editedAt, c.deletedAt]),
        ]
        return times.some((x) => x !== null && Date.parse(x) > after)
      })
      return result({
        ...draftInfo(snap.draft),
        password: undefined,
        threads: threads.map((t) =>
          threadInfo(t, pages.get(t.pageId)?.name ?? "", numbers.get(t.id))
        ),
      })
    }
  )

  server.registerTool(
    "reply_to_thread",
    {
      title: "Reply to thread",
      description:
        'Add a comment to a thread. It shows live to reviewers as "<operator> (Agent)". Plain text, max 5000 characters.',
      inputSchema: {
        project: slug,
        draft: slug,
        threadId: z.string(),
        body: z.string().min(1).max(5000),
      },
    },
    ({ project, draft, threadId, body }) => {
      const c = addComment(requireDraft(project, draft), threadId, {
        body,
        authorName: agentName(),
        clientId: agentClientId,
      })
      return result({ id: c.id, author: c.authorName, createdAt: c.createdAt })
    }
  )

  server.registerTool(
    "create_thread",
    {
      title: "Create thread",
      description:
        'Place a new pin with a first comment on a page, at x/y in design pixels from the page\'s top-left. Shows live to reviewers as "<operator> (Agent)".',
      inputSchema: {
        project: slug,
        draft: slug,
        pageId: z.string(),
        x: z.number().min(0),
        y: z.number().min(0),
        body: z.string().min(1).max(5000),
      },
    },
    ({ project, draft, pageId, x, y, body }) => {
      const d = requireDraft(project, draft)
      const t = createThread(d, {
        pageId,
        x,
        y,
        body,
        authorName: agentName(),
        clientId: agentClientId,
      })
      const snap = snapshot(d, true)
      const page = snap.draft.pages.find((p) => p.id === pageId)
      return result(
        threadInfo(t, page?.name ?? "", pinNumbers(snap.threads).get(t.id))
      )
    }
  )

  server.registerTool(
    "set_thread_status",
    {
      title: "Resolve or reopen thread",
      description:
        "`resolved` once the feedback is handled (reply first, saying what changed); `open` to reopen.",
      inputSchema: {
        project: slug,
        draft: slug,
        threadId: z.string(),
        status: z.enum(["open", "resolved"]),
      },
    },
    ({ project, draft, threadId, status }) => {
      const t = setThreadStatus(requireDraft(project, draft), threadId, status)
      return result({ id: t.id, status: t.status, resolvedAt: t.resolvedAt })
    }
  )

  // ---------- screenshots ----------

  server.registerTool(
    "get_page_screenshot",
    {
      title: "Page screenshot",
      description:
        "A rendered slice of a page as the reviewer sees it (no scripts), full design width, with pins drawn and numbered as in the viewer. Page through tall pages with `top`. Use it to check an upload or to see where feedback points when the page has no Paper link.",
      inputSchema: {
        project: slug,
        draft: slug,
        pageId: z.string(),
        top: z
          .number()
          .min(0)
          .optional()
          .describe("Design px from the top (default 0)."),
        height: z
          .number()
          .min(100)
          .max(MAX_CLIP_HEIGHT)
          .optional()
          .describe(`Design px (default 1200, max ${MAX_CLIP_HEIGHT}).`),
        pins: z
          .enum(["open", "all", "none"])
          .optional()
          .describe("Which pins to draw (default `open`)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      project,
      draft,
      pageId,
      top = 0,
      height = 1200,
      pins = "open",
    }) => {
      const d = requireDraft(project, draft)
      const snap = snapshot(d, true)
      const page = snap.draft.pages.find((p) => p.id === pageId)
      if (!page) throw notFound("Seite nicht gefunden.")
      const numbers = pinNumbers(snap.threads)
      const shown = snap.threads.filter(
        (t) =>
          t.pageId === pageId &&
          (pins === "all" || (pins === "open" && t.status === "open"))
      )
      const marks: PinMark[] = shown.map((t) => ({
        number: numbers.get(t.id)!,
        x: t.x,
        y: t.y,
        resolved: t.status === "resolved",
      }))
      const shot = await screenshotPage(pageHtml(d.id, pageId), {
        width: page.designWidth,
        pins: marks,
        clip: () => ({ x: 0, y: top, width: page.designWidth, height }),
      })
      const end = shot.clip.y + shot.clip.height
      return imageResult(shot.jpeg, {
        page: page.name,
        pageHeight: shot.pageHeight,
        shown: shot.clip,
        imageScale: shot.scale,
        nextTop: end < shot.pageHeight ? end : null,
        coordinates: COORDS,
        pins: shown
          .filter((t) => t.y >= shot.clip.y && t.y <= end)
          .map((t) => ({
            number: numbers.get(t.id),
            threadId: t.id,
            status: t.status,
            x: Math.round(t.x),
            y: Math.round(t.y),
            first: t.comments[0]?.body ?? "",
          })),
      })
    }
  )

  server.registerTool(
    "get_thread_screenshot",
    {
      title: "Thread screenshot",
      description:
        "The area around one pin, rendered as the reviewer sees it, with that pin ringed in red and the other open pins numbered. The fastest way to see what a comment points at.",
      inputSchema: {
        project: slug,
        draft: slug,
        threadId: z.string(),
        width: z
          .number()
          .min(200)
          .max(1600)
          .optional()
          .describe("Design px (default 1000)."),
        height: z
          .number()
          .min(200)
          .max(1600)
          .optional()
          .describe("Design px (default 700)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project, draft, threadId, width = 1000, height = 700 }) => {
      const d = requireDraft(project, draft)
      const snap = snapshot(d, true)
      const thread = snap.threads.find((t) => t.id === threadId)
      if (!thread) throw notFound("Thread nicht gefunden.")
      const page = snap.draft.pages.find((p) => p.id === thread.pageId)!
      const numbers = pinNumbers(snap.threads)
      const marks: PinMark[] = snap.threads
        .filter(
          (t) =>
            t.pageId === page.id && (t.status === "open" || t.id === threadId)
        )
        .map((t) => ({
          number: numbers.get(t.id)!,
          x: t.x,
          y: t.y,
          resolved: t.status === "resolved",
          focus: t.id === threadId,
        }))
      const w = Math.min(width, page.designWidth)
      const shot = await screenshotPage(pageHtml(d.id, page.id), {
        width: page.designWidth,
        pins: marks,
        clip: (pageHeight) => ({
          x: Math.min(Math.max(0, thread.x - w / 2), page.designWidth - w),
          y: Math.min(
            Math.max(0, thread.y - height / 2),
            Math.max(0, pageHeight - height)
          ),
          width: w,
          height,
        }),
      })
      return imageResult(shot.jpeg, {
        page: page.name,
        pageHeight: shot.pageHeight,
        shown: shot.clip,
        imageScale: shot.scale,
        coordinates: COORDS,
        thread: threadInfo(thread, page.name, numbers.get(thread.id)),
      })
    }
  )

  server.registerPrompt(
    SKILL_NAME,
    {
      title: "Paper → Draftly",
      description: SKILL_DESCRIPTION,
      argsSchema: {
        request: z
          .string()
          .optional()
          .describe(
            "Which artboards, and which project/draft, e.g. „Home und Kontakt nach kunde/website-v2“."
          ),
      },
    },
    ({ request }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${skillMarkdown(origin)}\n\n---\n\nTask: ${request?.trim() || "Upload the artboards I have selected in Paper to Draftly. Ask me for the project and draft if it is not clear."}`,
          },
        },
      ],
    })
  )

  server.registerResource(
    SKILL_NAME,
    `draftly://skill/${SKILL_NAME}`,
    {
      title: "Paper → Draftly skill",
      description: SKILL_DESCRIPTION,
      mimeType: "text/markdown",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: skillMarkdown(origin, { frontmatter: true }),
        },
      ],
    })
  )

  return server
}
