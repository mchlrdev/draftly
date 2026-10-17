import { isOperatorCookie } from "@/lib/server/auth"
import { handle, json } from "@/lib/server/http"

export const GET = handle((req) => json({ operator: isOperatorCookie(req.cookies) }))
