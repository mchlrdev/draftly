import { handle, json, readJson, requireOperator } from "@/lib/server/http"
import { createToken, listTokens } from "@/lib/server/tokens"

// Only the operator session manages tokens: a token cannot mint or list tokens.

export const GET = handle((req) => {
  requireOperator(req)
  return json(listTokens())
})

/** `{ name }` → 201 `{ token, apiToken }`. The plaintext token is shown once. */
export const POST = handle(async (req) => {
  requireOperator(req)
  return json(createToken(await readJson(req)), 201)
})
