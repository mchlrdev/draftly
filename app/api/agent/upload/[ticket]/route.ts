import { handle, json, type Params } from "@/lib/server/http"
import { createPage, replacePage } from "@/lib/server/store"
import { requireUploadTicket, withUploadTicket } from "@/lib/server/tokens"
import { readPageForm } from "@/lib/server/upload"

// The one-time link from the MCP tool `prepare_page_upload`: the ticket in the
// path is the credential, so an agent can `curl -F file=@page.html <url>`
// without its token. Same multipart form as the operator upload; fields sent
// here override the ones fixed on the ticket.

export const POST = handle<Params<"ticket">>(async (req, ctx) => {
  const { ticket } = await ctx.params
  requireUploadTicket(ticket)
  const form = await readPageForm(req)
  const set = (v: unknown) => (v === undefined || v === "" ? undefined : v)
  return withUploadTicket(ticket, ({ project, draft, pageId, defaults }) => {
    const input = {
      html: form.html,
      fileName: form.fileName,
      name: set(form.name) ?? defaults.name,
      display: set(form.display) ?? defaults.display,
      designWidth: set(form.designWidth) ?? defaults.designWidth,
    }
    return pageId
      ? json(replacePage(project, draft, pageId, input))
      : json(createPage(project, draft, input), 201)
  })
})
