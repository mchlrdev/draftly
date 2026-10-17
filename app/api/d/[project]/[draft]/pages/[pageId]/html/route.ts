import { requireDraftAccess } from "@/lib/server/access"
import { handle, type Params } from "@/lib/server/http"
import { pageHtml } from "@/lib/server/store"

// The uploaded page, for the viewer's sandboxed iframe. No scripts, framed only by us.
export const GET = handle<Params<"project" | "draft" | "pageId">>(async (req, ctx) => {
  const { project, draft, pageId } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  return new Response(pageHtml(access.draft.id, pageId), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "script-src 'none'; frame-ancestors 'self'",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    },
  })
})
