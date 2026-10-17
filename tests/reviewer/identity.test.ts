import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { authorKeyFor, sha256Fallback } from "../../lib/reviewer/identity"

const nodeHex = (s: string) => createHash("sha256").update(s).digest("hex")
const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

describe("authorKey", () => {
  it("matches the server's SHA-256 of the clientId", async () => {
    const id = "3f0c9a52-7d1e-4b8e-9a3c-5e2f1d0b7a64"
    expect(await authorKeyFor(id)).toBe(nodeHex(id))
  })

  it("the fallback hash for insecure contexts agrees with SHA-256", () => {
    for (const s of [
      "",
      "abc",
      "x".repeat(55),
      "y".repeat(56),
      "z".repeat(64),
      "ä€😀".repeat(40),
    ]) {
      expect(hex(sha256Fallback(new TextEncoder().encode(s)))).toBe(nodeHex(s))
    }
  })
})
