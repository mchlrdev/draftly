import {
  handle,
  json,
  noContent,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { readToken, revokeToken } from "@/lib/server/tokens"

/** `{ token }`, null for tokens made before it was stored. */
export const GET = handle<Params<"tokenId">>(async (req, ctx) => {
  requireOperator(req)
  const { tokenId } = await ctx.params
  return json(readToken(tokenId))
})

export const DELETE = handle<Params<"tokenId">>(async (req, ctx) => {
  requireOperator(req)
  const { tokenId } = await ctx.params
  revokeToken(tokenId)
  return noContent()
})
