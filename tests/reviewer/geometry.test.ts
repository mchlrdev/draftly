import { describe, expect, it } from "vitest"
import {
  FIXED_PAD_Y,
  clientToDesign,
  computeStageLayout,
  designToStage,
  placePopover,
  stepZoom,
} from "../../lib/reviewer/geometry"

describe("computeStageLayout", () => {
  it("keeps a fixed page at design width and centres it when the stage is wider", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 1920,
    })
    expect(l.scale).toBe(1)
    expect(l.frameWidth).toBe(1440)
    expect(l.renderedWidth).toBe(1440)
    expect(l.offsetX).toBe(240)
    expect(l.offsetY).toBe(FIXED_PAD_Y)
  })

  it("never scales a fixed page above 1", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 720,
      availableWidth: 1080,
    })
    expect(l.scale).toBe(1)
    expect(l.offsetX).toBe(180)
  })

  it("scales a fixed page down evenly to fit a narrower stage", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 1080,
    })
    expect(l.scale).toBe(0.75)
    expect(l.frameWidth).toBe(1440)
    expect(l.renderedWidth).toBe(1080)
    expect(l.offsetX).toBe(0)
  })

  it("gives a fill page the stage width at scale 1", () => {
    const l = computeStageLayout({
      display: "fill",
      designWidth: 1440,
      availableWidth: 1080,
    })
    expect(l).toEqual({
      scale: 1,
      fitScale: 1,
      frameWidth: 1080,
      renderedWidth: 1080,
      offsetX: 0,
      offsetY: 0,
      stageWidth: 1080,
    })
  })

  it("does not upscale a fill page either", () => {
    const l = computeStageLayout({
      display: "fill",
      designWidth: 1440,
      availableWidth: 2400,
    })
    expect(l.scale).toBe(1)
    expect(l.frameWidth).toBe(2400)
  })

  it("survives an unmeasured stage", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 0,
    })
    expect(l.scale).toBe(1)
    expect(l.offsetX).toBe(0)
  })
})

describe("computeStageLayout with zoom", () => {
  it("fit is the default and matches the available width", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 1080,
      zoom: "fit",
    })
    expect(l.scale).toBe(0.75)
    expect(l.fitScale).toBe(0.75)
    expect(l.stageWidth).toBe(1080)
  })

  it("an explicit zoom below fit centres the page in letterbox bands", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 1080,
      zoom: 0.5,
    })
    expect(l.scale).toBe(0.5)
    expect(l.fitScale).toBe(0.75)
    expect(l.renderedWidth).toBe(720)
    expect(l.offsetX).toBe(180)
    expect(l.stageWidth).toBe(1080)
  })

  it("an explicit zoom above fit widens the stage so it scrolls sideways", () => {
    const l = computeStageLayout({
      display: "fixed",
      designWidth: 1440,
      availableWidth: 1080,
      zoom: 1,
    })
    expect(l.scale).toBe(1)
    expect(l.renderedWidth).toBe(1440)
    expect(l.offsetX).toBe(0)
    expect(l.stageWidth).toBe(1440)
  })

  it("never zooms above 100% or below the smallest step", () => {
    const up = computeStageLayout({
      display: "fixed",
      designWidth: 720,
      availableWidth: 1080,
      zoom: 2,
    })
    expect(up.scale).toBe(1)
    const down = computeStageLayout({
      display: "fixed",
      designWidth: 720,
      availableWidth: 1080,
      zoom: 0.01,
    })
    expect(down.scale).toBe(0.25)
  })

  it("ignores zoom on a fill page", () => {
    const l = computeStageLayout({
      display: "fill",
      designWidth: 1440,
      availableWidth: 1080,
      zoom: 0.5,
    })
    expect(l.scale).toBe(1)
    expect(l.frameWidth).toBe(1080)
  })
})

describe("stepZoom", () => {
  it("steps to the next step above or below the current scale", () => {
    expect(stepZoom(0.63, 1)).toBe(0.75)
    expect(stepZoom(0.63, -1)).toBe(0.5)
    expect(stepZoom(0.75, 1)).toBe(1)
    expect(stepZoom(0.75, -1)).toBe(0.5)
  })

  it("stops at the ends", () => {
    expect(stepZoom(1, 1)).toBe(1)
    expect(stepZoom(0.25, -1)).toBe(0.25)
  })
})

describe("clientToDesign", () => {
  it("returns design pixels at scale 1", () => {
    const p = clientToDesign(
      { clientX: 700, clientY: 300 },
      { left: 180, top: 92, width: 720, height: 441 },
      1
    )
    expect(p).toEqual({ x: 520, y: 208 })
  })

  it("divides by the scale so a pin lands on the same design spot", () => {
    // 1440 design shown at 0.75 → 1080 wide on screen
    const p = clientToDesign(
      { clientX: 100 + 540, clientY: 50 + 300 },
      { left: 100, top: 50, width: 1080, height: 750 },
      0.75
    )
    expect(p).toEqual({ x: 720, y: 400 })
  })

  it("clamps to the page", () => {
    const p = clientToDesign(
      { clientX: 0, clientY: 9999 },
      { left: 10, top: 10, width: 500, height: 200 },
      0.5
    )
    expect(p).toEqual({ x: 0, y: 400 })
  })
})

describe("designToStage", () => {
  it("round-trips with clientToDesign at any scale", () => {
    for (const availableWidth of [600, 1080, 1440, 2000]) {
      const layout = computeStageLayout({
        display: "fixed",
        designWidth: 1440,
        availableWidth,
      })
      const design = { x: 534, y: 86 }
      const stage = designToStage(design, layout)
      const rect = {
        left: layout.offsetX,
        top: layout.offsetY,
        width: layout.renderedWidth,
        height: 2000 * layout.scale,
      }
      const back = clientToDesign(
        { clientX: stage.x, clientY: stage.y },
        rect,
        layout.scale
      )
      expect(back.x).toBeCloseTo(design.x, 1)
      expect(back.y).toBeCloseTo(design.y, 1)
    }
  })
})

describe("pins across zoom levels", () => {
  it("a click placed at 50% lands on the same design spot at 100%", () => {
    const at = (zoom: number) =>
      computeStageLayout({
        display: "fixed",
        designWidth: 1440,
        availableWidth: 1080,
        zoom,
      })
    const half = at(0.5)
    // Click 300/200 screen pixels into the page at 50%.
    const rectHalf = {
      left: half.offsetX,
      top: half.offsetY,
      width: half.renderedWidth,
      height: 2000 * half.scale,
    }
    const design = clientToDesign(
      { clientX: rectHalf.left + 300, clientY: rectHalf.top + 200 },
      rectHalf,
      half.scale
    )
    expect(design).toEqual({ x: 600, y: 400 })

    const full = at(1)
    const pin = designToStage(design, full)
    expect(pin).toEqual({
      x: full.offsetX + 600,
      y: full.offsetY + 400,
    })
    const rectFull = {
      left: full.offsetX,
      top: full.offsetY,
      width: full.renderedWidth,
      height: 2000,
    }
    expect(
      clientToDesign({ clientX: pin.x, clientY: pin.y }, rectFull, full.scale)
    ).toEqual(design)
  })

  it("round-trips at every zoom step", () => {
    for (const zoom of ["fit", 0.25, 0.5, 0.75, 1] as const) {
      const layout = computeStageLayout({
        display: "fixed",
        designWidth: 1440,
        availableWidth: 900,
        zoom,
      })
      const design = { x: 1234, y: 567 }
      const stage = designToStage(design, layout)
      const back = clientToDesign(
        { clientX: stage.x, clientY: stage.y },
        {
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.renderedWidth,
          height: 3000 * layout.scale,
        },
        layout.scale
      )
      expect(back.x).toBeCloseTo(design.x, 1)
      expect(back.y).toBeCloseTo(design.y, 1)
    }
  })
})

describe("placePopover", () => {
  it("opens to the right of the pin like the artboard (centre + 26, + dy)", () => {
    const p = placePopover({
      anchor: { x: 714, y: 178 },
      width: 320,
      containerWidth: 1080,
      dy: 22,
    })
    expect(p).toEqual({ left: 740, top: 200, side: "right" })
  })

  it("flips to the left when the right side would overflow", () => {
    const p = placePopover({
      anchor: { x: 900, y: 100 },
      width: 320,
      containerWidth: 1080,
      dy: -14,
    })
    expect(p).toEqual({ left: 900 - 26 - 320, top: 86, side: "left" })
  })

  it("stays inside a stage too narrow for either side", () => {
    const p = placePopover({
      anchor: { x: 200, y: 0 },
      width: 320,
      containerWidth: 360,
      dy: -14,
    })
    expect(p.left).toBe(28)
    expect(p.top).toBe(12)
  })
})
