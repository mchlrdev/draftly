import {
  handle,
  json,
  readJson,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { createDraft } from "@/lib/server/store"

export const POST = handle<Params<"project">>(async (req, ctx) => {
  requireOperator(req)
  const { project } = await ctx.params
  return json(createDraft(project, await readJson(req)), 201)
})
