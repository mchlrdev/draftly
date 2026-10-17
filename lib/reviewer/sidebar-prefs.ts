// How the comments sidebar is laid out in this browser: open or closed and
// its width. Pure parsing and clamping here; hooks/use-draft-sidebar.ts
// keeps it in localStorage.

/** Paper: the sidebar is 360px wide (w-90). */
export const SIDEBAR_DEFAULT_WIDTH = 360
export const SIDEBAR_MIN_WIDTH = 280
export const SIDEBAR_MAX_WIDTH = 560
/** One arrow-key press on the resize handle. */
export const SIDEBAR_KEY_STEP = 16

export interface SidebarPrefs {
  open: boolean
  width: number
}

export const DEFAULT_SIDEBAR_PREFS: SidebarPrefs = {
  open: true,
  width: SIDEBAR_DEFAULT_WIDTH,
}

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH
  return Math.round(
    Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))
  )
}

/** Reads stored JSON leniently: anything malformed falls back to defaults. */
export function parseSidebarPrefs(raw: string | null): SidebarPrefs {
  if (!raw) return DEFAULT_SIDEBAR_PREFS
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return DEFAULT_SIDEBAR_PREFS
  }
  if (!value || typeof value !== "object") return DEFAULT_SIDEBAR_PREFS
  const v = value as Partial<Record<keyof SidebarPrefs, unknown>>
  return {
    open: typeof v.open === "boolean" ? v.open : DEFAULT_SIDEBAR_PREFS.open,
    width:
      typeof v.width === "number"
        ? clampSidebarWidth(v.width)
        : DEFAULT_SIDEBAR_PREFS.width,
  }
}
