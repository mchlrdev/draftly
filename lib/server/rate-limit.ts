import "server-only"

// In-memory fixed-window limits per IP. One process, so no shared store needed.

type Bucket = "login" | "write"

const DEFAULTS: Record<Bucket, number> = { login: 10, write: 30 }
const ENV: Record<Bucket, string> = {
  login: "DRAFTLY_RATE_LOGIN",
  write: "DRAFTLY_RATE_WRITE",
}
const WINDOW_MS = 60_000

const g = globalThis as unknown as {
  __draftlyRate?: Map<string, { start: number; count: number }>
}
const hits = (g.__draftlyRate ??= new Map())

function limitFor(bucket: Bucket): number {
  const raw = Number(process.env[ENV[bucket]])
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULTS[bucket]
}

/**
 * The address the one trusted proxy (Traefik) saw. It appends the peer to
 * X-Forwarded-For, so only the LAST entry is trustworthy; earlier entries are
 * whatever the client sent and must not pick the rate-limit bucket.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  const last = xff?.split(",").at(-1)?.trim()
  return last || "local"
}

/** Counts one hit; false when the IP is over the limit for this window. */
export function allow(bucket: Bucket, req: Request): boolean {
  const key = `${bucket}:${clientIp(req)}`
  const t = Date.now()
  const entry = hits.get(key)
  if (!entry || t - entry.start >= WINDOW_MS) {
    hits.set(key, { start: t, count: 1 })
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (t - v.start >= WINDOW_MS) hits.delete(k)
    }
    return true
  }
  entry.count += 1
  return entry.count <= limitFor(bucket)
}
