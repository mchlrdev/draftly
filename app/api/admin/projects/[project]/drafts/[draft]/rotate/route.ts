import { handle, json, requireOperator, type Params } from "@/lib/server/http"
import { rotatePassword } from "@/lib/server/store"

export const POST = handle<Params<"project" | "draft">>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  return json(rotatePassword(project, draft))
})
