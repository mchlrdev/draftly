import { requireDraftAccess } from "@/lib/server/access"
import { handle, json, type Params } from "@/lib/server/http"
import { snapshot } from "@/lib/server/store"

export const GET = handle<Params<"project" | "draft">>(async (req, ctx) => {
  const { project, draft } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  return json(snapshot(access.draft, access.operator))
})
