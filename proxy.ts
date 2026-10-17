import { NextResponse } from "next/server"

// Drafts are unpublished work: keep every response out of search indexes.
export function proxy() {
  const res = NextResponse.next()
  res.headers.set("X-Robots-Tag", "noindex")
  return res
}
