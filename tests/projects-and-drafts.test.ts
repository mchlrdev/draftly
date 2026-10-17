import { describe, expect, it } from "vitest"
import type { Draft, Project } from "@/lib/api-types"
import { client, operator, reviewer, uniqueSlug } from "./helpers"

describe("projects", () => {
  it("creates a project with a chosen slug and lists it newest first", async () => {
    const op = await operator()
    const a = uniqueSlug("a")
    const b = uniqueSlug("b")
    const res = await op.post("/api/admin/projects", {
      slug: a,
      title: "Wellness-Oase",
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      slug: a,
      title: "Wellness-Oase",
      drafts: [],
    })
    await op.post("/api/admin/projects", { slug: b })
    const list = (await (
      await op.get("/api/admin/projects")
    ).json()) as Project[]
    const slugs = list.map((p) => p.slug)
    expect(slugs.indexOf(b)).toBeLessThan(slugs.indexOf(a))
    expect(list.find((p) => p.slug === b)?.title).toBe(b)
  })

  it("rejects a duplicate slug with 409", async () => {
    const op = await operator()
    const slug = uniqueSlug()
    await op.post("/api/admin/projects", { slug })
    const res = await op.post("/api/admin/projects", { slug })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual(expect.any(String))
  })

  it.each(["admin", "api", "_next", "Großbuchstaben", "-x", "a b", ""])(
    "rejects slug %j with 422",
    async (slug) => {
      const op = await operator()
      expect((await op.post("/api/admin/projects", { slug })).status).toBe(422)
    }
  )

  it("refuses to delete a project with drafts unless forced", async () => {
    const op = await operator()
    const slug = uniqueSlug()
    await op.post("/api/admin/projects", { slug })
    await op.post(`/api/admin/projects/${slug}/drafts`, { slug: "v1" })
    expect((await op.del(`/api/admin/projects/${slug}`)).status).toBe(409)
    expect((await op.del(`/api/admin/projects/${slug}?force=1`)).status).toBe(
      204
    )
    expect((await op.get(`/api/admin/projects/${slug}/drafts/v1`)).status).toBe(
      404
    )
  })

  it("deletes an empty project", async () => {
    const op = await operator()
    const slug = uniqueSlug()
    await op.post("/api/admin/projects", { slug })
    expect((await op.del(`/api/admin/projects/${slug}`)).status).toBe(204)
    expect((await op.del(`/api/admin/projects/${slug}`)).status).toBe(404)
  })
})

describe("drafts", () => {
  it("creates a draft with a generated password shown once", async () => {
    const op = await operator()
    const project = uniqueSlug()
    await op.post("/api/admin/projects", { slug: project, title: "Projekt" })
    const res = await op.post(`/api/admin/projects/${project}/drafts`, {
      slug: "v4",
    })
    expect(res.status).toBe(201)
    const { draft, password } = (await res.json()) as {
      draft: Draft
      password: string
    }
    expect(password).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/)
    expect(draft).toMatchObject({
      slug: "v4",
      projectSlug: project,
      projectTitle: "Projekt",
      letterbox: "#D8D2C8",
      pageCount: 0,
      openThreadCount: 0,
      pages: [],
    })
    const again = await (
      await op.get(`/api/admin/projects/${project}/drafts/v4`)
    ).text()
    expect(again).not.toContain(password)
    const listed = (await (
      await op.get("/api/admin/projects")
    ).json()) as Project[]
    expect(
      listed.find((p) => p.slug === project)?.drafts.map((d) => d.slug)
    ).toEqual(["v4"])
  })

  it("rejects duplicate draft slugs in the same project but allows them across projects", async () => {
    const op = await operator()
    const p1 = uniqueSlug()
    const p2 = uniqueSlug()
    await op.post("/api/admin/projects", { slug: p1 })
    await op.post("/api/admin/projects", { slug: p2 })
    expect(
      (await op.post(`/api/admin/projects/${p1}/drafts`, { slug: "v1" })).status
    ).toBe(201)
    expect(
      (await op.post(`/api/admin/projects/${p1}/drafts`, { slug: "v1" })).status
    ).toBe(409)
    expect(
      (await op.post(`/api/admin/projects/${p2}/drafts`, { slug: "v1" })).status
    ).toBe(201)
    expect(
      (await op.post(`/api/admin/projects/${p1}/drafts`, { slug: "Nope!" }))
        .status
    ).toBe(422)
  })

  it("404s for drafts under an unknown project", async () => {
    const op = await operator()
    expect(
      (
        await op.post(`/api/admin/projects/${uniqueSlug()}/drafts`, {
          slug: "v1",
        })
      ).status
    ).toBe(404)
    expect(
      (await op.get(`/api/admin/projects/${uniqueSlug()}/drafts/v1`)).status
    ).toBe(404)
  })

  it("sets the letterbox colour", async () => {
    const op = await operator()
    const project = uniqueSlug()
    await op.post("/api/admin/projects", { slug: project })
    await op.post(`/api/admin/projects/${project}/drafts`, {
      slug: "v1",
      letterbox: "#112233",
    })
    const res = await op.patch(`/api/admin/projects/${project}/drafts/v1`, {
      letterbox: "#a0b0c0",
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Draft).letterbox).toBe("#A0B0C0")
    expect(
      (
        await op.patch(`/api/admin/projects/${project}/drafts/v1`, {
          letterbox: "red",
        })
      ).status
    ).toBe(422)
  })

  it("rotates the password: the old one and old cookies stop working", async () => {
    const op = await operator()
    const project = uniqueSlug()
    await op.post("/api/admin/projects", { slug: project })
    const { password: oldPassword } = await (
      await op.post(`/api/admin/projects/${project}/drafts`, { slug: "v1" })
    ).json()
    const before = await reviewer(project, "v1", oldPassword)
    expect((await before.get(`/api/d/${project}/v1`)).status).toBe(200)

    const rotated = await op.post(
      `/api/admin/projects/${project}/drafts/v1/rotate`
    )
    expect(rotated.status).toBe(200)
    const { password: newPassword } = await rotated.json()
    expect(newPassword).not.toBe(oldPassword)

    expect((await before.get(`/api/d/${project}/v1`)).status).toBe(401)
    expect(
      (
        await client().post(`/api/d/${project}/v1/unlock`, {
          password: oldPassword,
        })
      ).status
    ).toBe(401)
    expect(
      (
        await client().post(`/api/d/${project}/v1/unlock`, {
          password: newPassword,
        })
      ).status
    ).toBe(204)
  })

  it("deleting a draft kills the public link", async () => {
    const op = await operator()
    const project = uniqueSlug()
    await op.post("/api/admin/projects", { slug: project })
    const { password } = await (
      await op.post(`/api/admin/projects/${project}/drafts`, { slug: "v1" })
    ).json()
    const r = await reviewer(project, "v1", password)
    expect(
      (await op.del(`/api/admin/projects/${project}/drafts/v1`)).status
    ).toBe(204)
    expect((await r.get(`/api/d/${project}/v1`)).status).toBe(401)
    expect((await op.get(`/api/d/${project}/v1`)).status).toBe(404)
  })

  it("keeps operator endpoints closed to reviewers", async () => {
    const op = await operator()
    const project = uniqueSlug()
    await op.post("/api/admin/projects", { slug: project })
    const { password } = await (
      await op.post(`/api/admin/projects/${project}/drafts`, { slug: "v1" })
    ).json()
    const r = await reviewer(project, "v1", password)
    expect(
      (await r.get(`/api/admin/projects/${project}/drafts/v1`)).status
    ).toBe(401)
    expect(
      (await r.post(`/api/admin/projects/${project}/drafts/v1/rotate`)).status
    ).toBe(401)
  })
})
