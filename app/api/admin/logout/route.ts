import { destroySession } from "@/lib/server/auth"
import { handle, noContent, withCookies } from "@/lib/server/http"

export const POST = handle((req) =>
  withCookies(noContent(), destroySession(req.cookies))
)
