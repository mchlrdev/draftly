import { describe, expect, it } from "vitest"
import type { Comment, DraftSnapshot, Thread } from "../../lib/api-types"
import {
  draftReducer,
  numberedThreads,
  openCount,
} from "../../hooks/use-draft-state"

const comment = (
  id: string,
  threadId: string,
  at: string,
  over: Partial<Comment> = {}
): Comment => ({
  id,
  threadId,
  authorName: "Tanja",
  authorKey: "k-1",
  body: `body ${id}`,
  createdAt: at,
  editedAt: null,
  deletedAt: null,
  ...over,
})

const thread = (
  id: string,
  pageId: string,
  at: string,
  over: Partial<Thread> = {}
): Thread => ({
  id,
  pageId,
  x: 10,
  y: 20,
  status: "open",
  createdAt: at,
  resolvedAt: null,
  comments: [comment(`${id}-c1`, id, at)],
  ...over,
})

function snapshot(threads: Thread[] = []): DraftSnapshot {
  return {
    operator: false,
    threads,
    draft: {
      slug: "v4",
      projectSlug: "tanja",
      projectTitle: "Tanjas Wellness-Oase",
      letterbox: "#D8D2C8",
      createdAt: "2026-10-01T00:00:00Z",
      pageCount: 2,
      openThreadCount: 0,
      pages: [],
    },
  }
}

describe("draftReducer", () => {
  it("replaces everything with a snapshot", () => {
    const fresh = snapshot([thread("t1", "p1", "2026-10-02T00:00:00Z")])
    expect(
      draftReducer(snapshot(), { type: "snapshot", snapshot: fresh })
    ).toBe(fresh)
  })

  it("adds a created thread once, even when our own write and its echo both arrive", () => {
    const t = thread("t1", "p1", "2026-10-02T00:00:00Z")
    let s = draftReducer(snapshot(), {
      type: "event",
      event: { type: "thread.created", thread: t },
    })
    s = draftReducer(s, {
      type: "event",
      event: { type: "thread.created", thread: t },
    })
    expect(s.threads).toHaveLength(1)
  })

  it("keeps threads ordered by creation", () => {
    let s = snapshot([thread("t2", "p1", "2026-10-03T00:00:00Z")])
    s = draftReducer(s, {
      type: "event",
      event: {
        type: "thread.created",
        thread: thread("t1", "p1", "2026-10-02T00:00:00Z"),
      },
    })
    expect(s.threads.map((t) => t.id)).toEqual(["t1", "t2"])
  })

  it("updates a thread's status", () => {
    const t = thread("t1", "p1", "2026-10-02T00:00:00Z")
    const s = draftReducer(snapshot([t]), {
      type: "event",
      event: {
        type: "thread.updated",
        thread: {
          ...t,
          status: "resolved",
          resolvedAt: "2026-10-04T00:00:00Z",
        },
      },
    })
    expect(s.threads[0].status).toBe("resolved")
  })

  it("does not drop a reply that an older thread copy lacks", () => {
    const t = thread("t1", "p1", "2026-10-02T00:00:00Z")
    let s = draftReducer(snapshot([t]), {
      type: "event",
      event: {
        type: "comment.created",
        comment: comment("r1", "t1", "2026-10-02T01:00:00Z"),
      },
    })
    s = draftReducer(s, {
      type: "event",
      event: { type: "thread.updated", thread: { ...t, status: "resolved" } },
    })
    expect(s.threads[0].comments.map((c) => c.id)).toEqual(["t1-c1", "r1"])
    expect(s.threads[0].status).toBe("resolved")
  })

  it("removes a deleted thread", () => {
    const s = draftReducer(
      snapshot([thread("t1", "p1", "2026-10-02T00:00:00Z")]),
      {
        type: "event",
        event: { type: "thread.deleted", threadId: "t1", pageId: "p1" },
      }
    )
    expect(s.threads).toHaveLength(0)
  })

  it("adds, edits and soft-deletes comments", () => {
    let s = snapshot([thread("t1", "p1", "2026-10-02T00:00:00Z")])
    const reply = comment("r1", "t1", "2026-10-02T01:00:00Z", {
      authorName: "Pascal",
      authorKey: "k-2",
    })
    s = draftReducer(s, {
      type: "event",
      event: { type: "comment.created", comment: reply },
    })
    s = draftReducer(s, {
      type: "event",
      event: { type: "comment.created", comment: reply },
    })
    expect(s.threads[0].comments).toHaveLength(2)

    s = draftReducer(s, {
      type: "event",
      event: {
        type: "comment.updated",
        comment: { ...reply, body: "neu", editedAt: "2026-10-02T02:00:00Z" },
      },
    })
    expect(s.threads[0].comments[1].body).toBe("neu")

    s = draftReducer(s, {
      type: "event",
      event: {
        type: "comment.deleted",
        comment: { ...reply, body: "", deletedAt: "2026-10-02T03:00:00Z" },
      },
    })
    expect(s.threads[0].comments[1].deletedAt).not.toBeNull()
    expect(s.threads[0].comments).toHaveLength(2)
  })

  it("ignores a comment for a thread it does not know", () => {
    const s = snapshot()
    expect(
      draftReducer(s, {
        type: "event",
        event: {
          type: "comment.created",
          comment: comment("x", "nope", "2026-10-02T00:00:00Z"),
        },
      })
    ).toBe(s)
  })

  it("does not mutate the previous state", () => {
    const t = thread("t1", "p1", "2026-10-02T00:00:00Z")
    const before = snapshot([t])
    const frozen = JSON.stringify(before)
    draftReducer(before, {
      type: "event",
      event: {
        type: "comment.created",
        comment: comment("r1", "t1", "2026-10-03T00:00:00Z"),
      },
    })
    draftReducer(before, {
      type: "event",
      event: { type: "thread.deleted", threadId: "t1", pageId: "p1" },
    })
    expect(JSON.stringify(before)).toBe(frozen)
  })
})

describe("reconnect resync", () => {
  it("events buffered during a reload, replayed on an older snapshot, land exactly once", () => {
    const t1 = thread("t1", "p1", "2026-10-02T00:00:00Z")
    const t2 = thread("t2", "p1", "2026-10-03T00:00:00Z")
    const reply = comment("r1", "t1", "2026-10-03T01:00:00Z")
    const buffered = [
      { type: "thread.created", thread: t2 },
      { type: "comment.created", comment: reply },
      { type: "thread.deleted", threadId: "t0", pageId: "p1" },
    ] as const
    // Live: applied as they arrive...
    let s = snapshot([thread("t0", "p1", "2026-10-01T00:00:00Z"), t1])
    for (const event of buffered) s = draftReducer(s, { type: "event", event })
    // ...then the reload answers with a snapshot taken before them, and the buffer is replayed.
    s = draftReducer(s, {
      type: "snapshot",
      snapshot: snapshot([thread("t0", "p1", "2026-10-01T00:00:00Z"), t1]),
    })
    for (const event of buffered) s = draftReducer(s, { type: "event", event })
    expect(s.threads.map((t) => t.id)).toEqual(["t1", "t2"])
    expect(s.threads[0].comments.map((c) => c.id)).toEqual(["t1-c1", "r1"])
  })
})

describe("selectors", () => {
  const s = snapshot([
    thread("a", "p1", "2026-10-02T00:00:00Z"),
    thread("b", "p2", "2026-10-02T00:30:00Z"),
    thread("c", "p1", "2026-10-03T00:00:00Z", { status: "resolved" }),
    thread("d", "p1", "2026-10-04T00:00:00Z"),
  ])

  it("numbers threads per page, counting resolved ones too", () => {
    expect(
      numberedThreads(s, "p1").map(({ thread, number }) => [thread.id, number])
    ).toEqual([
      ["a", 1],
      ["c", 2],
      ["d", 3],
    ])
    expect(numberedThreads(s, "p2").map(({ number }) => number)).toEqual([1])
  })

  it("counts open threads per page", () => {
    expect(openCount(s, "p1")).toBe(2)
    expect(openCount(s, "p2")).toBe(1)
  })
})
