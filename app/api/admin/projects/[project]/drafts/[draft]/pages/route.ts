import { handle, json, readJson, requireOperator, type Params } from "@/lib/server/http"
import { createPage, reorderPages } from "@/lib/server/store"
import { readPageForm } from "@/lib/server/upload"

type Ctx = Params<"project" | "draft">

export const POST = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  return json(createPage(project, draft, await readPageForm(req)), 201)
})

/** Reorder: `{ order: pageId[] }`. */
export const PUT = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  const { order } = await readJson(req)
  return json(reorderPages(project, draft, order))
})
