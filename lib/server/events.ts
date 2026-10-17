import "server-only"

import type { DraftEvent } from "@/lib/api-types"

// In-process pub/sub keyed by draft id. Kept on globalThis so dev HMR and
// separately bundled route handlers share one registry.

type Listener = (event: DraftEvent) => void

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
  for (const listener of channels.get(draftId) ?? []) {
    try {
      listener(event)
    } catch (err) {
      console.error(err)
    }
  }
}
