import { requireDraftAccess } from "@/lib/server/access"
import { handle, type Params } from "@/lib/server/http"
import { subscribe } from "@/lib/server/events"

const PING_MS = 15_000

/** Server-sent events for one draft: `event: <type>` + `data: <DraftEvent JSON>`. */
export const GET = handle<Params<"project" | "draft">>(async (req, ctx) => {
  const { project, draft } = await ctx.params
  const access = requireDraftAccess(req, project, draft)
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      const unsubscribe = subscribe(access.draft.id, (event) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      })
      const ping = setInterval(() => send(": ping\n\n"), PING_MS)
      let done = false
      cleanup = () => {
        if (done) return
        done = true
        clearInterval(ping)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      req.signal.addEventListener("abort", cleanup, { once: true })
      // Open the stream right away so proxies and clients see headers + first bytes.
      send(": connected\nretry: 3000\n\n")
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
})
