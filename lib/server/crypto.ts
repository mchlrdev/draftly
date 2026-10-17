import "server-only"

import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { db } from "./db"

/** URL-safe random id. */
export function newId(bytes = 12): string {
  return randomBytes(bytes).toString("base64url")
}

// Crockford-ish base32 without look-alikes (no 0/o, 1/l/i).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

/** Readable generated draft password, e.g. `k7mq-2xpr-9tnd`. */
export function generatePassword(): string {
  const groups: string[] = []
  for (let g = 0; g < 3; g++) {
    let s = ""
    for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)]
    groups.push(s)
  }
  return groups.join("-")
}

const SCRYPT_N = 16384

/** `scrypt$<salt>$<hash>` (base64url). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32, { N: SCRYPT_N })
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$")
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64url")
  const actual = scryptSync(
    password,
    Buffer.from(saltB64, "base64url"),
    expected.length,
    { N: SCRYPT_N }
  )
  return timingSafeEqual(actual, expected)
}

/** Constant-time string compare (for the operator password). */
export function safeEqual(a: string, b: string): boolean {
  const ka = createHmac("sha256", "cmp").update(a).digest()
  const kb = createHmac("sha256", "cmp").update(b).digest()
  return timingSafeEqual(ka, kb)
}

/** Random server secret, created once and kept in the meta table. */
export function serverSecret(): string {
  const conn = db()
  const row = conn
    .prepare("SELECT value FROM meta WHERE key = 'secret'")
    .get() as { value: string } | undefined
  if (row) return row.value
  const value = randomBytes(32).toString("base64url")
  conn
    .prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('secret', ?)")
    .run(value)
  return (
    conn.prepare("SELECT value FROM meta WHERE key = 'secret'").get() as {
      value: string
    }
  ).value
}

export function hmac(data: string): string {
  return createHmac("sha256", serverSecret()).update(data).digest("base64url")
}
