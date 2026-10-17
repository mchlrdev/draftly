import { describe, expect, it } from "vitest"
import { client, operator } from "./helpers"

describe("operator session", () => {
  it("is signed out without a cookie", async () => {
    const c = client()
    const res = await c.get("/api/admin/session")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ operator: false })
  })

  it("signs in with the environment password and gets an HTTP-only cookie", async () => {
    const c = client()
    const res = await c.post("/api/admin/login", { password: "test-secret" })
    expect(res.status).toBe(204)
    const cookie = res.headers.getSetCookie().find((l) => l.startsWith("draftly_admin="))
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(await (await c.get("/api/admin/session")).json()).toEqual({ operator: true })
  })

  it("rejects a wrong password with a German error and no session", async () => {
    const c = client()
    const res = await c.post("/api/admin/login", { password: "nope" })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toEqual(expect.any(String))
    expect(c.jar.has("draftly_admin")).toBe(false)
    expect(await (await c.get("/api/admin/session")).json()).toEqual({ operator: false })
  })

  it("requires the session for operator endpoints", async () => {
    const res = await client().get("/api/admin/projects")
    expect(res.status).toBe(401)
  })

  it("does not accept a made-up session token", async () => {
    const c = client()
    c.jar.set("draftly_admin", "forged")
    expect((await c.get("/api/admin/projects")).status).toBe(401)
  })

  it("logs out and the old cookie stops working", async () => {
    const op = await operator()
    const token = op.jar.get("draftly_admin")!
    expect((await op.post("/api/admin/logout")).status).toBe(204)
    expect(op.jar.has("draftly_admin")).toBe(false)
    const replay = client()
    replay.jar.set("draftly_admin", token)
    expect((await replay.get("/api/admin/projects")).status).toBe(401)
  })

  it("rate-limits password guesses per IP", async () => {
    const c = client()
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await c.post("/api/admin/login", { password: "x" })).status)
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
    // A different IP is unaffected.
    expect((await client().post("/api/admin/login", { password: "test-secret" })).status).toBe(204)
  })

  it("keys the limit on the last X-Forwarded-For hop, so a spoofed first entry does not help", async () => {
    const c = client()
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const res = await c.request("/api/admin/login", {
        method: "POST",
        json: { password: "x" },
        headers: { "x-forwarded-for": `203.0.113.${i + 1}, ${c.ip}` },
      })
      statuses.push(res.status)
    }
    expect(statuses[10]).toBe(429)
  })

  it("marks every response noindex", async () => {
    const res = await client().get("/api/admin/session")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
    const missing = await client().get("/definitely-not-here/nope/deeper")
    expect(missing.headers.get("x-robots-tag")).toBe("noindex")
  })
})
