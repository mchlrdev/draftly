import { describe, expect, it } from "vitest"
import type { DraftEvent, Thread } from "@/lib/api-types"
import { baseUrl, reviewer, setupDraft, type Client } from "./helpers"

/** Opens the SSE stream for a client and collects parsed events. */
async function listen(c: Client, api: string) {
  const controller = new AbortController()
  const res = await c.request(`${api}/events`, { signal: controller.signal })
  expect(res.status).toBe(200)
  expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/)
  const events: { name: string; data: DraftEvent }[] = []
  const waiters: (() => void)[] = []
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += value
        let idx: number
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const name = /^event: (.*)$/m.exec(block)?.[1]
          const data = /^data: (.*)$/m.exec(block)?.[1]
          if (name && data) {
            events.push({ name, data: JSON.parse(data) })
            waiters.splice(0).forEach((w) => w())
          }
        }
      }
    } catch {
      // aborted
    }
  })()

  async function next(type: DraftEvent["type"], timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const hit = events.find((e) => e.name === type)
      if (hit) {
        events.splice(events.indexOf(hit), 1)
        return hit.data
      }
      const left = deadline - Date.now()
      if (left <= 0) throw new Error(`no ${type} within ${timeoutMs} ms`)
      await new Promise<void>((resolve) => {
        waiters.push(resolve)
        setTimeout(resolve, left)
      })
    }
  }

  return { next, events, close: () => controller.abort() }
}

const pin = { x: 10, y: 20, body: "Live", authorName: "Tanja", clientId: "a" }

describe("live events", () => {
  it("a second client receives thread.created within two seconds", async () => {
    const { project, draft, password, api, pageId } = await setupDraft()
    const writer = await reviewer(project, draft, password)
    const watcher = await reviewer(project, draft, password)
    const stream = await listen(watcher, api)
    try {
      const started = Date.now()
      const created = (await (await writer.post(`${api}/threads`, { ...pin, pageId })).json()) as Thread
      const event = await stream.next("thread.created")
      expect(Date.now() - started).toBeLessThan(2000)
      expect(event).toEqual({ type: "thread.created", thread: created })
    } finally {
      stream.close()
    }
  })

  it("carries full objects for replies, edits, deletes, status and thread delete", async () => {
    const { op, project, draft, password, api, pageId } = await setupDraft()
    const r = await reviewer(project, draft, password)
    const stream = await listen(op, api)
    try {
      const thread = (await (await r.post(`${api}/threads`, { ...pin, pageId })).json()) as Thread
      await stream.next("thread.created")

      const reply = await (await r.post(`${api}/threads/${thread.id}/comments`, { body: "Antwort", authorName: "P", clientId: "b" })).json()
      expect(await stream.next("comment.created")).toEqual({ type: "comment.created", comment: reply })

      const edited = await (await r.patch(`${api}/comments/${reply.id}`, { body: "Neu", clientId: "b" })).json()
      expect(await stream.next("comment.updated")).toEqual({ type: "comment.updated", comment: edited })

      const deleted = await (await r.del(`${api}/comments/${reply.id}`, { clientId: "b" })).json()
      expect(await stream.next("comment.deleted")).toEqual({ type: "comment.deleted", comment: deleted })

      const resolved = await (await op.patch(`${api}/threads/${thread.id}`, { status: "resolved" })).json()
      expect(await stream.next("thread.updated")).toEqual({ type: "thread.updated", thread: resolved })

      await op.del(`${api}/threads/${thread.id}`)
      expect(await stream.next("thread.deleted")).toEqual({ type: "thread.deleted", threadId: thread.id, pageId })
    } finally {
      stream.close()
    }
  })

  it("does not leak events across drafts", async () => {
    const a = await setupDraft()
    const b = await setupDraft()
    const stream = await listen(b.op, b.api)
    try {
      await a.op.post(`${a.api}/threads`, { ...pin, pageId: a.pageId })
      await expect(stream.next("thread.created", 500)).rejects.toThrow()
    } finally {
      stream.close()
    }
  })

  it("needs access", async () => {
    const { api } = await setupDraft()
    const res = await fetch(`${baseUrl()}${api}/events`)
    expect(res.status).toBe(401)
  })
})
