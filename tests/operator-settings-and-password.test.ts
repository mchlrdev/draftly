import { describe, expect, it } from "vitest"
import type { DraftSnapshot } from "@/lib/api-types"
import { client, operator, reviewer, setupDraft, uniqueSlug } from "./helpers"

describe("operator settings", () => {
  it("needs the operator session", async () => {
    const anon = client()
    expect((await anon.get("/api/admin/settings")).status).toBe(401)
    expect(
      (await anon.put("/api/admin/settings", { operatorName: "X" })).status
    ).toBe(401)
  })

  it("stores the operator name, trims it, and clears it on empty", async () => {
    const op = await operator()
    const put = await op.put("/api/admin/settings", {
      operatorName: "  Pascal  ",
    })
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ operatorName: "Pascal" })
    expect(await (await op.get("/api/admin/settings")).json()).toEqual({
      operatorName: "Pascal",
    })

    const cleared = await op.put("/api/admin/settings", { operatorName: "" })
    expect(await cleared.json()).toEqual({ operatorName: null })
    expect(await (await op.get("/api/admin/settings")).json()).toEqual({
      operatorName: null,
    })
  })

  it("rejects a name longer than 60 characters", async () => {
    const op = await operator()
    const res = await op.put("/api/admin/settings", {
      operatorName: "x".repeat(61),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toEqual(expect.any(String))
  })

  it("puts the name into the snapshot for the operator only", async () => {
    const { op, api, project, draft, password } = await setupDraft()
    await op.put("/api/admin/settings", { operatorName: "Pascal" })
    const mine = (await (await op.get(api)).json()) as DraftSnapshot
    expect(mine.operator).toBe(true)
    expect(mine.operatorName).toBe("Pascal")

    const rev = await reviewer(project, draft, password)
    const theirs = (await (await rev.get(api)).json()) as DraftSnapshot
    expect(theirs.operator).toBe(false)
    expect(theirs.operatorName).toBeNull()
  })
})

describe("draft password, readable by the operator", () => {
  it("returns the password set on create", async () => {
    const { op, admin, password } = await setupDraft()
    const res = await op.get(`${admin}/password`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ password })
  })

  it("returns the new password after a rotation, and it unlocks", async () => {
    const { op, admin, project, draft, password } = await setupDraft()
    const rotated = (await (await op.post(`${admin}/rotate`)).json()) as {
      password: string
    }
    expect(rotated.password).not.toBe(password)
    const read = (await (await op.get(`${admin}/password`)).json()) as {
      password: string
    }
    expect(read.password).toBe(rotated.password)
    const rev = await reviewer(project, draft, read.password)
    expect((await rev.get(`/api/d/${project}/${draft}`)).status).toBe(200)
  })

  it("is 401 without the operator session, even for an unlocked reviewer", async () => {
    const { admin, project, draft, password } = await setupDraft()
    expect((await client().get(`${admin}/password`)).status).toBe(401)
    const rev = await reviewer(project, draft, password)
    expect((await rev.get(`${admin}/password`)).status).toBe(401)
  })

  it("is 404 for an unknown draft", async () => {
    const op = await operator()
    expect(
      (await op.get(`/api/admin/projects/${uniqueSlug()}/drafts/v1/password`))
        .status
    ).toBe(404)
  })

  it("never shows up in the draft or project listing", async () => {
    const { op, admin, password } = await setupDraft()
    expect(await (await op.get(admin)).text()).not.toContain(password)
    expect(await (await op.get("/api/admin/projects")).text()).not.toContain(
      password
    )
  })
})
