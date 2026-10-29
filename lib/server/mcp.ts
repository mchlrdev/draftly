import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod"
import { SKILL_DESCRIPTION, SKILL_NAME, skillMarkdown } from "@/lib/agent/skill"
import type { Draft } from "@/lib/api-types"
import {
  createDraft,
  createPage,
  createProject,
  listProjects,
  readPassword,
  reorderPages,
  replacePage,
  requireDraft,
  toDraft,
} from "./store"
import { createUploadTicket } from "./tokens"

// The MCP server behind /api/mcp (ADR 0004). Built fresh per request (the
// transport is stateless) for one authenticated token. Tools cover what an
// agent needs to put pages on a draft; deleting stays with the operator.

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
}

const result = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

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
      instructions: `Draftly hosts HTML pages for client review: project → draft (one link + password) → pages. To put Paper artboards on a draft, follow the prompt "${SKILL_NAME}" (also the resource draftly://skill/${SKILL_NAME}): Paper get_jsx → ${origin}/agent/paper-to-html.mjs → prepare_page_upload. Pages must be self-contained HTML (no http/https URLs, max 25 MB).`,
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
      updatedAt: p.updatedAt,
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
    ({ project, draft, pageId, name, display, designWidth }) => {
      const { ticket, expiresAt } = createUploadTicket(tokenId, {
        project,
        draft,
        pageId,
        name,
        display,
        designWidth,
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
    ({ project, draft, html, pageId, name, display, designWidth }) => {
      const input = { html, name, display, designWidth }
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
