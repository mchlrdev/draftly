import { handle, json, readJson, requireOperator } from "@/lib/server/http"
import { createProject, listProjects } from "@/lib/server/store"

export const GET = handle((req) => {
  requireOperator(req)
  return json(listProjects())
})

export const POST = handle(async (req) => {
  requireOperator(req)
  const body = await readJson(req)
  return json(createProject(body), 201)
})
