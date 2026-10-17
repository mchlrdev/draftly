import { describe, expect, it } from "vitest"
import {
  DEFAULT_SIDEBAR_PREFS,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
  parseSidebarPrefs,
} from "../../lib/reviewer/sidebar-prefs"

describe("sidebar prefs", () => {
  it("falls back to open at the default width", () => {
    expect(parseSidebarPrefs(null)).toEqual(DEFAULT_SIDEBAR_PREFS)
    expect(parseSidebarPrefs("not json")).toEqual(DEFAULT_SIDEBAR_PREFS)
    expect(parseSidebarPrefs("42")).toEqual(DEFAULT_SIDEBAR_PREFS)
  })

  it("keeps stored values and clamps the width", () => {
    expect(parseSidebarPrefs('{"open":false,"width":400}')).toEqual({
      open: false,
      width: 400,
    })
    expect(parseSidebarPrefs('{"open":true,"width":9000}').width).toBe(
      SIDEBAR_MAX_WIDTH
    )
    expect(parseSidebarPrefs('{"width":"wide"}')).toEqual(DEFAULT_SIDEBAR_PREFS)
  })

  it("clamps widths between min and max", () => {
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH)
    expect(clampSidebarWidth(1000)).toBe(SIDEBAR_MAX_WIDTH)
    expect(clampSidebarWidth(321.6)).toBe(322)
    expect(clampSidebarWidth(Number.NaN)).toBe(DEFAULT_SIDEBAR_PREFS.width)
  })
})
