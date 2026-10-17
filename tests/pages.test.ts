import { describe, expect, it } from "vitest"
import type { Draft, DraftSnapshot, Page, Thread } from "@/lib/api-types"
import { FIXTURE_HTML, client, pageForm, reviewer, setupDraft } from "./helpers"

const upload = (op: Awaited<ReturnType<typeof setupDraft>>["op"], path: string, form: FormData, method = "POST") =>
  op.request(path, { method, body: form })

async function pinThread(c: ReturnType<typeof client>, api: string, pageId: string) {
  const res = await c.post(`${api}/threads`, { pageId, x: 120, y: 840.5, body: "Hier", authorName: "Tanja", clientId: "c1" })
  expect(res.status).toBe(201)
  return (await res.json()) as Thread
}

describe("page upload", () => {
  it("accepts self-contained HTML with name, display and design width", async () => {
    const { op, admin } = await setupDraft()
    const res = await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, name: "Kontakt", display: "fill", designWidth: "1280" }))
    expect(res.status).toBe(201)
    const page = (await res.json()) as Page
    expect(page).toMatchObject({ name: "Kontakt", display: "fill", designWidth: 1280, sort: 1 })
    const draft = (await (await op.get(admin)).json()) as Draft
    expect(draft.pages.map((p) => p.name)).toEqual(["Start", "Kontakt"])
    expect(draft.pageCount).toBe(2)
  })

  it("defaults design width to 1440 and display to fixed", async () => {
    const { op, admin } = await setupDraft()
    const page = (await (await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, name: "X" }))).json()) as Page
    expect(page).toMatchObject({ display: "fixed", designWidth: 1440 })
  })

  it.each([
    `<img src="https://cdn.paper.design/x.png">`,
    `<link href="http://fonts.example/x.css" rel="stylesheet">`,
    `<style>@font-face{src:url(HTTPS://x/y.woff2)}</style>`,
  ])("rejects HTML that references a live URL: %s", async (snippet) => {
    const { op, admin } = await setupDraft()
    const res = await upload(op, `${admin}/pages`, pageForm({ html: `<html><body>${snippet}</body></html>`, name: "Bad" }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/http/)
    expect(((await (await op.get(admin)).json()) as Draft).pageCount).toBe(1)
  })

  it("rejects a missing file and bad display/width", async () => {
    const { op, admin } = await setupDraft()
    expect((await upload(op, `${admin}/pages`, pageForm({ name: "Leer" }))).status).toBe(422)
    expect((await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, display: "stretch" }))).status).toBe(422)
    expect((await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, designWidth: "breit" }))).status).toBe(422)
  })

  it("is operator-only", async () => {
    const { project, draft, password, admin } = await setupDraft()
    const r = await reviewer(project, draft, password)
    expect((await r.request(`${admin}/pages`, { method: "POST", body: pageForm({ html: FIXTURE_HTML }) })).status).toBe(401)
  })
})

describe("page replace, update, reorder, delete", () => {
  it("replacing keeps the page id and its threads", async () => {
    const { op, admin, api, pageId } = await setupDraft()
    const thread = await pinThread(op, api, pageId)
    const res = await upload(op, `${admin}/pages/${pageId}`, pageForm({ html: "<p>Neu</p>", name: "Start v2" }), "PUT")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: pageId, name: "Start v2" })
    expect(await (await op.get(`${api}/pages/${pageId}/html`)).text()).toBe("<p>Neu</p>")
    const snap = (await (await op.get(api)).json()) as DraftSnapshot
    expect(snap.threads.map((t) => t.id)).toEqual([thread.id])
  })

  it("replace rejects live URLs and keeps the old HTML", async () => {
    const { op, admin, api, pageId } = await setupDraft()
    const res = await upload(op, `${admin}/pages/${pageId}`, pageForm({ html: "<a href='https://x'>x</a>" }), "PUT")
    expect(res.status).toBe(422)
    expect(await (await op.get(`${api}/pages/${pageId}/html`)).text()).toBe(FIXTURE_HTML)
  })

  it("patches page metadata", async () => {
    const { op, admin, pageId } = await setupDraft()
    const res = await op.patch(`${admin}/pages/${pageId}`, { name: "Startseite", display: "fill", designWidth: 1200 })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: pageId, name: "Startseite", display: "fill", designWidth: 1200 })
  })

  it("reorders pages", async () => {
    const { op, admin, pageId } = await setupDraft()
    const second = (await (await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, name: "B" }))).json()) as Page
    const res = await op.put(`${admin}/pages`, { order: [second.id, pageId] })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Page[]).map((p) => p.id)).toEqual([second.id, pageId])
    expect(((await (await op.get(admin)).json()) as Draft).pages.map((p) => p.name)).toEqual(["B", "Start"])
    expect((await op.put(`${admin}/pages`, { order: [pageId] })).status).toBe(422)
  })

  it("deleting a page deletes its threads", async () => {
    const { op, admin, api, pageId } = await setupDraft()
    const other = (await (await upload(op, `${admin}/pages`, pageForm({ html: FIXTURE_HTML, name: "B" }))).json()) as Page
    await pinThread(op, api, pageId)
    const kept = await pinThread(op, api, other.id)
    expect((await op.del(`${admin}/pages/${pageId}`)).status).toBe(204)
    const snap = (await (await op.get(api)).json()) as DraftSnapshot
    expect(snap.threads.map((t) => t.id)).toEqual([kept.id])
    expect(snap.draft.pages.map((p) => p.id)).toEqual([other.id])
    expect((await op.get(`${api}/pages/${pageId}/html`)).status).toBe(404)
    expect((await op.del(`${admin}/pages/${pageId}`)).status).toBe(404)
  })
})

describe("password gate", () => {
  it("shows neither HTML nor comments without the password", async () => {
    const { op, api, pageId } = await setupDraft()
    await pinThread(op, api, pageId)
    const stranger = client()
    for (const path of [api, `${api}/pages/${pageId}/html`, `${api}/events`]) {
      const res = await stranger.get(path)
      expect(res.status).toBe(401)
      const text = await res.text()
      expect(text).not.toContain("Fixture")
      expect(text).not.toContain("Hier")
    }
  })

  it("answers an unknown draft exactly like a locked one", async () => {
    const { api } = await setupDraft()
    const locked = await client().get(api)
    const unknown = await client().get(`${api}-gibts-nicht`)
    expect(unknown.status).toBe(locked.status)
    expect(await unknown.text()).toBe(await locked.text())
    const wrong = await client().post(`${api}/unlock`, { password: "falsch" })
    const missing = await client().post(`${api}-gibts-nicht/unlock`, { password: "falsch" })
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toEqual({ error: "Passwort stimmt nicht." })
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: "Passwort stimmt nicht." })
  })

  it("the right password unlocks the snapshot and the sandboxed HTML", async () => {
    const { project, draft, password, api, pageId } = await setupDraft()
    const r = client()
    const res = await r.post(`${api}/unlock`, { password })
    expect(res.status).toBe(204)
    expect(res.headers.getSetCookie().join("\n")).toMatch(/draftly_d_[^=]+=.*HttpOnly/i)
    const snap = (await (await r.get(api)).json()) as DraftSnapshot
    expect(snap.operator).toBe(false)
    expect(snap.draft).toMatchObject({ slug: draft, projectSlug: project, projectTitle: "Projekt" })
    expect(snap.draft.pages[0].id).toBe(pageId)
    const html = await r.get(`${api}/pages/${pageId}/html`)
    expect(html.status).toBe(200)
    expect(html.headers.get("content-type")).toMatch(/^text\/html/)
    expect(html.headers.get("content-security-policy")).toBe("script-src 'none'; frame-ancestors 'self'")
    expect(html.headers.get("x-content-type-options")).toBe("nosniff")
    expect(await html.text()).toBe(FIXTURE_HTML)
  })

  it("a draft cookie does not open another draft", async () => {
    const a = await setupDraft()
    const b = await setupDraft()
    const r = await reviewer(a.project, a.draft, a.password)
    expect((await r.get(b.api)).status).toBe(401)
  })

  it("the operator session skips the gate and sees operator: true", async () => {
    const { op, api, pageId } = await setupDraft()
    const snap = (await (await op.get(api)).json()) as DraftSnapshot
    expect(snap.operator).toBe(true)
    expect((await op.get(`${api}/pages/${pageId}/html`)).status).toBe(200)
    expect((await op.get(`${api}x`)).status).toBe(404)
  })

  it("rate-limits password guesses per IP", async () => {
    const { api } = await setupDraft()
    const c = client()
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await c.post(`${api}/unlock`, { password: "falsch" })).status)
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401))
    expect(statuses[10]).toBe(429)
  })
})
