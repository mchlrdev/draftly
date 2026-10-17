import "server-only"

import type { DraftEvent } from "@/lib/api-types"

// In-process pub/sub keyed by draft id. Kept on globalThis so dev HMR and
// separately bundled route handlers share one registry.

/** Internal only, never sent to clients: the stream must end (draft password
 *  rotated or draft deleted), so a reconnect re-checks access. */
export const CLOSE_STREAM = { type: "stream.close" } as const

export type BusMessage = DraftEvent | typeof CLOSE_STREAM

type Listener = (message: BusMessage) => void

const g = globalThis as unknown as { __draftlyEvents?: Map<string, Set<Listener>> }
const channels = (g.__draftlyEvents ??= new Map())

export function subscribe(draftId: string, listener: Listener): () => void {
  let set = channels.get(draftId)
  if (!set) channels.set(draftId, (set = new Set()))
  set.add(listener)
  return () => {
    set.delete(listener)
    if (!set.size) channels.delete(draftId)
  }
}

export function publish(draftId: string, event: DraftEvent): void {
  send(draftId, event)
}

/** Ends every open event stream of this draft. */
export function closeStreams(draftId: string): void {
  send(draftId, CLOSE_STREAM)
}

function send(draftId: string, message: BusMessage): void {
  for (const listener of [...(channels.get(draftId) ?? [])]) {
    try {
      listener(message)
    } catch (err) {
      console.error(err)
    }
  }
}
