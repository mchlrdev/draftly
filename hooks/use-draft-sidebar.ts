"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  DEFAULT_SIDEBAR_PREFS,
  clampSidebarWidth,
  parseSidebarPrefs,
  type SidebarPrefs,
} from "@/lib/reviewer/sidebar-prefs"

// The comments sidebar's open state and width, kept in localStorage so they
// survive reloads and apply to every draft on this origin. Server render and
// hydration use the defaults; the stored values take over right after.

const KEY = "draftly.sidebar"

const listeners = new Set<() => void>()
let cached: SidebarPrefs | null = null

function read(): SidebarPrefs {
  if (cached) return cached
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    raw = null
  }
  cached = parseSidebarPrefs(raw)
  return cached
}

function write(next: SidebarPrefs) {
  cached = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or blocked storage: keep it for this tab only.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    cached = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

export function useDraftSidebar() {
  const prefs = useSyncExternalStore(
    subscribe,
    read,
    () => DEFAULT_SIDEBAR_PREFS
  )
  const setOpen = useCallback((open: boolean) => {
    const current = read()
    if (current.open !== open) write({ ...current, open })
  }, [])
  const toggle = useCallback(() => {
    const current = read()
    write({ ...current, open: !current.open })
  }, [])
  const setWidth = useCallback((width: number) => {
    const current = read()
    const next = clampSidebarWidth(width)
    if (current.width !== next) write({ ...current, width: next })
  }, [])
  return { ...prefs, setOpen, toggle, setWidth }
}
