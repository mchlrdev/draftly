import { requireDraftAccess } from "@/lib/server/access"
import { handle, json, readJson, type Params } from "@/lib/server/http"
import { editComment, removeComment } from "@/lib/server/store"

type Ctx = Params<"project" | "draft" | "commentId">

/** Edit own comment (same clientId). */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { project, draft, commentId } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  return json(editComment(access.draft, commentId, await readJson(req)))
})

/** Soft delete: own comment (same clientId) or any comment for the operator. */
export const DELETE = handle<Ctx>(async (req, ctx) => {
  const { project, draft, commentId } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  const { clientId } = await readJson(req)
  return json(removeComment(access.draft, commentId, clientId, access.operator))
})
