import { handle, json, readJson, requireOperator } from "@/lib/server/http"
import { getSettings, updateSettings } from "@/lib/server/store"

export const GET = handle((req) => {
  requireOperator(req)
  return json(getSettings())
})

export const PUT = handle(async (req) => {
  requireOperator(req)
  return json(updateSettings(await readJson(req)))
})
