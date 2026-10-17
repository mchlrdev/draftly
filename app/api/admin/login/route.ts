import { checkOperatorPassword, createSession } from "@/lib/server/auth"
import {
  HttpError,
  handle,
  noContent,
  readJson,
  tooManyRequests,
  withCookies,
} from "@/lib/server/http"
import { allow } from "@/lib/server/rate-limit"

export const POST = handle(async (req) => {
  if (!allow("login", req)) throw tooManyRequests()
  const { password } = await readJson(req)
  if (!checkOperatorPassword(password))
    throw new HttpError(401, "Passwort stimmt nicht.")
  return withCookies(noContent(), createSession())
})
