import { handle, json, noContent, readJson, requireOperator, type Params } from "@/lib/server/http"
import { deleteDraft, requireDraft, toDraft, updateDraft } from "@/lib/server/store"

type Ctx = Params<"project" | "draft">

export const GET = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  return json(toDraft(requireDraft(project, draft)))
})

export const PATCH = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  return json(updateDraft(project, draft, await readJson(req)))
})

export const DELETE = handle<Ctx>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  deleteDraft(project, draft)
  return noContent()
})
