import { requireDraftAccess, requireOperatorAccess } from "@/lib/server/access"
import {
  handle,
  json,
  noContent,
  readJson,
  type Params,
} from "@/lib/server/http"
import { deleteThread, setThreadStatus } from "@/lib/server/store"

type Ctx = Params<"project" | "draft" | "threadId">

/** Resolve / reopen. Operator only. */
export const PATCH = handle<Ctx>(async (req, ctx) => {
  const { project, draft, threadId } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  requireOperatorAccess(access)
  const { status } = await readJson(req)
  return json(setThreadStatus(access.draft, threadId, status))
})

export const DELETE = handle<Ctx>(async (req, ctx) => {
  const { project, draft, threadId } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  requireOperatorAccess(access)
  deleteThread(access.draft, threadId)
  return noContent()
})
