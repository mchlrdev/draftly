import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { db, now } from "./db"
import { hmac, safeEqual } from "./crypto"

// Operator session (draftly_admin) and draft unlock cookies (draftly_d_<draftId>).

export const ADMIN_COOKIE = "draftly_admin"
const SESSION_DAYS = 30

/** Anything with a cookie getter: NextRequest.cookies or next/headers cookies(). */
export interface CookieReader {
  get(name: string): { value: string } | undefined
}

export interface CookieSpec {
  name: string
  value: string
  options: {
    httpOnly: true
    sameSite: "lax"
    secure: boolean
    path: "/"
    maxAge?: number
  }
}

function cookie(name: string, value: string, maxAge?: number): CookieSpec {
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(maxAge !== undefined ? { maxAge } : {}),
    },
  }
}

export function adminPassword(): string | null {
  const env = process.env.ADMIN_PASSWORD
  if (env) return env
  return process.env.NODE_ENV === "production" ? null : "draftly"
}

export function checkOperatorPassword(password: unknown): boolean {
  const expected = adminPassword()
  if (!expected || typeof password !== "string") return false
  return safeEqual(password, expected)
}

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("base64url")
}

export function createSession(): CookieSpec {
  const token = randomBytes(32).toString("base64url")
  db()
    .prepare("INSERT INTO sessions (token, created_at) VALUES (?, ?)")
    .run(tokenKey(token), now())
  return cookie(ADMIN_COOKIE, token)
}

export function destroySession(cookies: CookieReader): CookieSpec {
  const token = cookies.get(ADMIN_COOKIE)?.value
  if (token)
    db().prepare("DELETE FROM sessions WHERE token = ?").run(tokenKey(token))
  return cookie(ADMIN_COOKIE, "", 0)
}

export function isOperatorCookie(cookies: CookieReader): boolean {
  const token = cookies.get(ADMIN_COOKIE)?.value
  if (!token) return false
  const row = db()
    .prepare("SELECT created_at FROM sessions WHERE token = ?")
    .get(tokenKey(token)) as { created_at: string } | undefined
  if (!row) return false
  if (Date.now() - Date.parse(row.created_at) > SESSION_DAYS * 86_400_000) {
    db().prepare("DELETE FROM sessions WHERE token = ?").run(tokenKey(token))
    return false
  }
  return true
}

export function draftCookieName(draftId: string): string {
  return `draftly_d_${draftId}`
}

// The password hash carries a fresh salt per rotation, so binding the cookie
// to it invalidates every old cookie when the password is rotated.
function draftProof(draftId: string, passwordHash: string): string {
  return hmac(`draft:${draftId}:${passwordHash}`)
}

export function draftCookie(draftId: string, passwordHash: string): CookieSpec {
  return cookie(
    draftCookieName(draftId),
    draftProof(draftId, passwordHash),
    60 * 60 * 24 * 90
  )
}

export function hasDraftCookie(
  cookies: CookieReader,
  draftId: string,
  passwordHash: string
): boolean {
  const value = cookies.get(draftCookieName(draftId))?.value
  if (!value) return false
  return safeEqual(value, draftProof(draftId, passwordHash))
}
