import { NextResponse } from "next/server"

// Drafts are unpublished work: keep every response out of search indexes
// (robots.txt asks crawlers not to come at all, app/robots.ts).
export function proxy() {
  const res = NextResponse.next()
  res.headers.set("X-Robots-Tag", "noindex, nofollow")
  return res
}
