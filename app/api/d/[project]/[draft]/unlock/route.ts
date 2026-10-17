import { draftCookie } from "@/lib/server/auth"
import { HttpError, handle, noContent, readJson, tooManyRequests, withCookies, type Params } from "@/lib/server/http"
import { allow } from "@/lib/server/rate-limit"
import { checkDraftPassword } from "@/lib/server/store"

export const POST = handle<Params<"project" | "draft">>(async (req, ctx) => {
  if (!allow("login", req)) throw tooManyRequests()
  const { project, draft } = await ctx.params
  const { password } = await readJson(req)
  const row = checkDraftPassword(project, draft, password)
  if (!row) throw new HttpError(401, "Passwort stimmt nicht.")
  return withCookies(noContent(), draftCookie(row.id, row.password_hash))
})
