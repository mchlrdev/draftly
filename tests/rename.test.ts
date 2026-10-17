import { describe, expect, it } from "vitest"
import type { Draft, Project } from "@/lib/api-types"
import { client, operator, reviewer, setupDraft, uniqueSlug } from "./helpers"

describe("PATCH /api/admin/projects/:project", () => {
  it("needs the operator session", async () => {
    const { project } = await setupDraft()
    expect(
      (await client().patch(`/api/admin/projects/${project}`, { title: "X" }))
        .status
    ).toBe(401)
  })

  it("changes the title", async () => {
    const op = await operator()
    const slug = uniqueSlug()
    await op.post("/api/admin/projects", { slug, title: "Alt" })
    const res = await op.patch(`/api/admin/projects/${slug}`, {
      title: "  Neu  ",
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ slug, title: "Neu" })
  })

  it("changes the slug; drafts and reviewer cookies move along", async () => {
    const { op, project, draft, password } = await setupDraft()
    const rev = await reviewer(project, draft, password)
    const next = uniqueSlug("renamed")
    const res = await op.patch(`/api/admin/projects/${project}`, {
      slug: next,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Project
    expect(body.slug).toBe(next)
    expect(body.drafts.map((d) => d.slug)).toEqual([draft])
    expect(body.drafts[0].projectSlug).toBe(next)

    expect(
      (await op.get(`/api/admin/projects/${project}/drafts/${draft}`)).status
    ).toBe(404)
    expect(
      (await op.get(`/api/admin/projects/${next}/drafts/${draft}`)).status
    ).toBe(200)
    expect((await rev.get(`/api/d/${next}/${draft}`)).status).toBe(200)
    expect((await rev.get(`/api/d/${project}/${draft}`)).status).toBe(401)
  })

  it("keeping the same slug is fine", async () => {
    const op = await operator()
    const slug = uniqueSlug()
    await op.post("/api/admin/projects", { slug })
    expect(
      (await op.patch(`/api/admin/projects/${slug}`, { slug, title: "T" }))
        .status
    ).toBe(200)
  })

  it("rejects a taken slug with 409 and bad or reserved slugs with 422", async () => {
    const op = await operator()
    const a = uniqueSlug()
    const b = uniqueSlug()
    await op.post("/api/admin/projects", { slug: a })
    await op.post("/api/admin/projects", { slug: b })
    expect(
      (await op.patch(`/api/admin/projects/${a}`, { slug: b })).status
    ).toBe(409)
    for (const slug of ["admin", "api", "Groß", "-x", ""])
      expect(
        (await op.patch(`/api/admin/projects/${a}`, { slug })).status
      ).toBe(422)
    expect(
      (await op.patch(`/api/admin/projects/${a}`, { title: "x".repeat(121) }))
        .status
    ).toBe(422)
  })

  it("404s for an unknown project", async () => {
    const op = await operator()
    expect(
      (await op.patch(`/api/admin/projects/${uniqueSlug()}`, { title: "X" }))
        .status
    ).toBe(404)
  })
})

describe("PATCH draft slug", () => {
  it("renames the draft; the reviewer cookie keeps working at the new URL", async () => {
    const { op, admin, project, draft, password } = await setupDraft()
    const rev = await reviewer(project, draft, password)
    const res = await op.patch(admin, { slug: "v2" })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Draft).slug).toBe("v2")
    expect((await op.get(admin)).status).toBe(404)
    expect(
      (await op.get(`/api/admin/projects/${project}/drafts/v2`)).status
    ).toBe(200)
    expect((await rev.get(`/api/d/${project}/v2`)).status).toBe(200)
    // The password stays the same.
    expect(
      (await client().post(`/api/d/${project}/v2/unlock`, { password })).status
    ).toBe(204)
  })

  it("changes slug and letterbox in one request", async () => {
    const { op, admin, project } = await setupDraft()
    const res = await op.patch(admin, { slug: "final", letterbox: "#102030" })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      slug: "final",
      projectSlug: project,
      letterbox: "#102030",
    })
  })

  it("rejects a slug taken in the same project with 409, bad slugs with 422", async () => {
    const { op, admin, project } = await setupDraft()
    await op.post(`/api/admin/projects/${project}/drafts`, { slug: "v2" })
    expect((await op.patch(admin, { slug: "v2" })).status).toBe(409)
    expect((await op.patch(admin, { slug: "Nope!" })).status).toBe(422)
    expect((await op.patch(admin, { slug: "v1" })).status).toBe(200)
  })
})
