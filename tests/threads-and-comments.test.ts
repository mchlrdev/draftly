import { describe, expect, it } from "vitest"
import type { Comment, DraftSnapshot, Page, Thread } from "@/lib/api-types"
import { FIXTURE_HTML, client, pageForm, reviewer, setupDraft } from "./helpers"

async function withReviewer() {
  const ctx = await setupDraft()
  const r = await reviewer(ctx.project, ctx.draft, ctx.password)
  return { ...ctx, r }
}

const pin = { x: 412.5, y: 1830, body: "Logo größer?", authorName: "Tanja", clientId: "browser-a" }

describe("threads", () => {
  it("a reviewer pins a thread; x/y and body round-trip through the snapshot", async () => {
    const { r, api, pageId } = await withReviewer()
    const res = await r.post(`${api}/threads`, { ...pin, pageId })
    expect(res.status).toBe(201)
    const thread = (await res.json()) as Thread
    expect(thread).toMatchObject({ pageId, x: 412.5, y: 1830, status: "open", resolvedAt: null })
    expect(thread.comments).toHaveLength(1)
    expect(thread.comments[0]).toMatchObject({ body: "Logo größer?", authorName: "Tanja", clientId: "browser-a", editedAt: null, deletedAt: null })

    const snap = (await (await r.get(api)).json()) as DraftSnapshot
    expect(snap.threads).toEqual([thread])
    expect(snap.draft.openThreadCount).toBe(1)
  })

  it("stores the body as text, untouched", async () => {
    const { r, api, pageId } = await withReviewer()
    const body = `<img src=x onerror="alert(1)"> & "quotes"`
    const thread = (await (await r.post(`${api}/threads`, { ...pin, pageId, body })).json()) as Thread
    expect(thread.comments[0].body).toBe(body)
  })

  it("keeps threads on their page", async () => {
    const { op, r, api, admin, pageId } = await withReviewer()
    const other = (await (
      await op.request(`${admin}/pages`, { method: "POST", body: pageForm({ html: FIXTURE_HTML, name: "B" }) })
    ).json()) as Page
    await r.post(`${api}/threads`, { ...pin, pageId })
    await r.post(`${api}/threads`, { ...pin, pageId: other.id })
    const snap = (await (await r.get(api)).json()) as DraftSnapshot
    expect(snap.threads.map((t) => t.pageId).sort()).toEqual([pageId, other.id].sort())
  })

  it.each([
    [{ body: "   " }],
    [{ body: "x".repeat(5001) }],
    [{ authorName: "" }],
    [{ authorName: "n".repeat(61) }],
    [{ x: -1 }],
    [{ y: "12" }],
    [{ clientId: "" }],
  ])("rejects invalid input %j with 422", async (patch) => {
    const { r, api, pageId } = await withReviewer()
    expect((await r.post(`${api}/threads`, { ...pin, pageId, ...patch })).status).toBe(422)
  })

  it("accepts a body of exactly 5000 characters", async () => {
    const { r, api, pageId } = await withReviewer()
    expect((await r.post(`${api}/threads`, { ...pin, pageId, body: "x".repeat(5000) })).status).toBe(201)
  })

  it("404s for a page of another draft", async () => {
    const a = await withReviewer()
    const b = await setupDraft()
    expect((await a.r.post(`${a.api}/threads`, { ...pin, pageId: b.pageId })).status).toBe(404)
  })

  it("needs the password", async () => {
    const { api, pageId } = await setupDraft()
    expect((await client().post(`${api}/threads`, { ...pin, pageId })).status).toBe(401)
  })

  it("only the operator resolves, reopens and deletes threads", async () => {
    const { op, r, api, pageId } = await withReviewer()
    const thread = (await (await r.post(`${api}/threads`, { ...pin, pageId })).json()) as Thread

    const denied = await r.patch(`${api}/threads/${thread.id}`, { status: "resolved" })
    expect(denied.status).toBe(403)
    expect((await denied.json()).error).toEqual(expect.any(String))
    expect((await r.del(`${api}/threads/${thread.id}`)).status).toBe(403)

    const resolved = await op.patch(`${api}/threads/${thread.id}`, { status: "resolved" })
    expect(resolved.status).toBe(200)
    const body = (await resolved.json()) as Thread
    expect(body.status).toBe("resolved")
    expect(body.resolvedAt).toEqual(expect.any(String))
    expect(((await (await op.get(api)).json()) as DraftSnapshot).draft.openThreadCount).toBe(0)

    const reopened = (await (await op.patch(`${api}/threads/${thread.id}`, { status: "open" })).json()) as Thread
    expect(reopened).toMatchObject({ status: "open", resolvedAt: null })
    expect((await op.patch(`${api}/threads/${thread.id}`, { status: "done" })).status).toBe(422)

    expect((await op.del(`${api}/threads/${thread.id}`)).status).toBe(204)
    expect(((await (await r.get(api)).json()) as DraftSnapshot).threads).toEqual([])
    expect((await op.del(`${api}/threads/${thread.id}`)).status).toBe(404)
  })
})

describe("comments", () => {
  async function withThread() {
    const ctx = await withReviewer()
    const thread = (await (await ctx.r.post(`${ctx.api}/threads`, { ...pin, pageId: ctx.pageId })).json()) as Thread
    return { ...ctx, thread }
  }

  it("a reviewer replies in a thread; comments come oldest first", async () => {
    const { r, api, thread } = await withThread()
    const res = await r.post(`${api}/threads/${thread.id}/comments`, { body: "Antwort", authorName: "Pascal", clientId: "browser-b" })
    expect(res.status).toBe(201)
    const reply = (await res.json()) as Comment
    expect(reply).toMatchObject({ threadId: thread.id, body: "Antwort", authorName: "Pascal", clientId: "browser-b" })
    const snap = (await (await r.get(api)).json()) as DraftSnapshot
    expect(snap.threads[0].comments.map((c) => c.body)).toEqual(["Logo größer?", "Antwort"])
  })

  it("the same clientId edits its own comment; another clientId gets 403", async () => {
    const { r, api, thread } = await withThread()
    const id = thread.comments[0].id
    const other = await r.patch(`${api}/comments/${id}`, { body: "Gekapert", clientId: "browser-b" })
    expect(other.status).toBe(403)
    expect((await other.json()).error).toEqual(expect.any(String))
    const res = await r.patch(`${api}/comments/${id}`, { body: "Logo deutlich größer", clientId: "browser-a" })
    expect(res.status).toBe(200)
    const edited = (await res.json()) as Comment
    expect(edited).toMatchObject({ id, body: "Logo deutlich größer" })
    expect(edited.editedAt).toEqual(expect.any(String))
    expect((await r.patch(`${api}/comments/${id}`, { body: "", clientId: "browser-a" })).status).toBe(422)
  })

  it("survives a new connection: identity is the clientId, not the cookie", async () => {
    const { project, draft, password, api, thread } = await withThread()
    const later = await reviewer(project, draft, password)
    const res = await later.patch(`${api}/comments/${thread.comments[0].id}`, { body: "Nach Reconnect", clientId: "browser-a" })
    expect(res.status).toBe(200)
  })

  it("the same clientId soft-deletes its own comment; another clientId gets 403", async () => {
    const { r, api, thread } = await withThread()
    const id = thread.comments[0].id
    expect((await r.del(`${api}/comments/${id}`, { clientId: "browser-b" })).status).toBe(403)
    const res = await r.del(`${api}/comments/${id}`, { clientId: "browser-a" })
    expect(res.status).toBe(200)
    const deleted = (await res.json()) as Comment
    expect(deleted).toMatchObject({ id, body: "" })
    expect(deleted.deletedAt).toEqual(expect.any(String))
    const snap = (await (await r.get(api)).json()) as DraftSnapshot
    expect(snap.threads[0].comments[0]).toMatchObject({ id, body: "" })
    expect(JSON.stringify(snap)).not.toContain("Logo größer?")
  })

  it("the operator deletes anyone's comment", async () => {
    const { op, api, thread } = await withThread()
    const res = await op.del(`${api}/comments/${thread.comments[0].id}`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as Comment).deletedAt).toEqual(expect.any(String))
  })

  it("404s for a comment of another draft", async () => {
    const a = await withThread()
    const b = await withReviewer()
    expect((await b.r.patch(`${b.api}/comments/${a.thread.comments[0].id}`, { body: "x", clientId: "browser-a" })).status).toBe(404)
  })

  it("rate-limits thread and comment creation per IP", async () => {
    const { r, api, pageId, thread } = await withThread()
    // withThread already created one thread from this IP.
    const statuses: number[] = []
    for (let i = 0; i < 29; i++) {
      const path = i % 2 ? `${api}/threads/${thread.id}/comments` : `${api}/threads`
      statuses.push((await r.post(path, { ...pin, pageId })).status)
    }
    expect(statuses.every((s) => s === 201)).toBe(true)
    expect((await r.post(`${api}/threads`, { ...pin, pageId })).status).toBe(429)
  })
})
