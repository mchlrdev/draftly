import {
  handle,
  json,
  noContent,
  readJson,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { deleteProject, updateProject } from "@/lib/server/store"

export const PATCH = handle<Params<"project">>(async (req, ctx) => {
  requireOperator(req)
  const { project } = await ctx.params
  return json(updateProject(project, await readJson(req)))
})

export const DELETE = handle<Params<"project">>(async (req, ctx) => {
  requireOperator(req)
  const { project } = await ctx.params
  const force = ["1", "true"].includes(
    req.nextUrl.searchParams.get("force") ?? ""
  )
  deleteProject(project, force)
  return noContent()
})
