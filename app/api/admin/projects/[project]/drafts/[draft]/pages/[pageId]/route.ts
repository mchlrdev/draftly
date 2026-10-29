import {
  handle,
  json,
  noContent,
  readJson,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { deletePage, replacePage, updatePage } from "@/lib/server/store"
import { readPageForm } from "@/lib/server/upload"

type Ctx = Params<"project" | "draft" | "pageId">

/** Replace the HTML: same id, threads kept. */
export const PUT = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft, pageId } = await ctx.params
  return json(replacePage(project, draft, pageId, await readPageForm(req)))
})

export const PATCH = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft, pageId } = await ctx.params
  const { name, display, designWidth, paperFileId, paperNodeId } =
    await readJson(req)
  return json(
    updatePage(project, draft, pageId, {
      name,
      display,
      designWidth,
      paperFileId,
      paperNodeId,
    })
  )
})

export const DELETE = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft, pageId } = await ctx.params
  deletePage(project, draft, pageId)
  return noContent()
})
