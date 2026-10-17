import { handle, json, requireOperator, type Params } from "@/lib/server/http"
import { readPassword } from "@/lib/server/store"

export const GET = handle<Params<"project" | "draft">>(async (req, ctx) => {
  requireOperator(req)
  const { project, draft } = await ctx.params
  return json(readPassword(project, draft))
})
