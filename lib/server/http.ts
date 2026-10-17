import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import type { CookieSpec } from "./auth"
import { isOperatorCookie } from "./auth"

// Small helpers shared by app/api/** route handlers.

/** Throw from anywhere in a handler; `handle` turns it into `{ error }`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export const notFound = (msg = "Nicht gefunden.") => new HttpError(404, msg)
export const unprocessable = (msg: string) => new HttpError(422, msg)

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  })
}

export function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  })
}

export function errorResponse(status: number, message: string): NextResponse {
  return json({ error: message }, status)
}

export function withCookies<T extends NextResponse>(
  res: T,
  ...cookies: CookieSpec[]
): T {
  for (const c of cookies) res.cookies.set(c.name, c.value, c.options)
  return res
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response

/** Wraps a route handler: HttpError → JSON error, anything else → 500 (German). */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof HttpError)
        return errorResponse(err.status, err.message)
      console.error(err)
      return errorResponse(
        500,
        "Interner Fehler. Bitte später erneut versuchen."
      )
    }
  }
}

/** Parses a JSON object body; empty body → {}. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (!text.trim()) return {}
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new HttpError(400, "Ungültige Anfrage.")
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new HttpError(400, "Ungültige Anfrage.")
  return data as Record<string, unknown>
}

export function requireOperator(req: NextRequest): void {
  if (!isOperatorCookie(req.cookies))
    throw new HttpError(401, "Bitte melde dich an.")
}

export const tooManyRequests = () =>
  new HttpError(429, "Zu viele Versuche. Bitte warte einen Moment.")

/** Route handler context with typed dynamic params (independent of generated route types). */
export type Params<K extends string> = { params: Promise<Record<K, string>> }
