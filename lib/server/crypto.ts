import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
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

// ---------- draft password at rest (ADR 0002 amendment) ----------
// AES-256-GCM under a key derived (HKDF-SHA256) from the server secret.
// Stored as `v1$<iv>$<tag>$<ciphertext>` (base64url). Reviewer access is still
// checked against the scrypt hash; this copy only lets the operator read it.

function passwordKey(): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      serverSecret(),
      Buffer.alloc(0),
      "draftly:draft-password:v1",
      32
    )
  )
}

export function encryptPassword(password: string, aad: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", passwordKey(), iv)
  cipher.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([cipher.update(password, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return ["v1", iv, tag, ct]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join("$")
}

/** Null when missing or when it does not decrypt (wrong secret, tampered). */
export function decryptPassword(
  stored: string | null | undefined,
  aad: string
): string | null {
  if (!stored) return null
  const [version, iv, tag, ct] = stored.split("$")
  if (version !== "v1" || !iv || !tag || !ct) return null
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      passwordKey(),
      Buffer.from(iv, "base64url")
    )
    decipher.setAAD(Buffer.from(aad))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(ct, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}
