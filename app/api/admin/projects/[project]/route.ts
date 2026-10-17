import {
  handle,
  noContent,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { deleteProject } from "@/lib/server/store"

export const DELETE = handle<Params<"project">>(async (req, ctx) => {
  requireOperator(req)
  const { project } = await ctx.params
  const force = ["1", "true"].includes(
    req.nextUrl.searchParams.get("force") ?? ""
  )
  deleteProject(project, force)
  return noContent()
})
