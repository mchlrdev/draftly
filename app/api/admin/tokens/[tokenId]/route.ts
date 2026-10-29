import {
  handle,
  noContent,
  requireOperator,
  type Params,
} from "@/lib/server/http"
import { revokeToken } from "@/lib/server/tokens"

export const DELETE = handle<Params<"tokenId">>(async (req, ctx) => {
  requireOperator(req)
  const { tokenId } = await ctx.params
  revokeToken(tokenId)
  return noContent()
})
