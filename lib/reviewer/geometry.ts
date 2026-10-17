// Pure maths for the viewer stage: how a page is sized and scaled inside the
// available width, and how a click maps to design pixels and back.
// Thread x/y are design pixels from the page's top-left (api-contract.md), so
// everything here converts between that space and the stage's local pixels.

import type { DisplayMode } from "@/lib/api-types"

/** Vertical letterbox band above and below a fixed page (Paper: Canvas py-10). */
export const FIXED_PAD_Y = 40

export interface StageLayout {
  /** Uniform scale applied to the page wrapper. Never above 1. */
  scale: number
  /** The scale "Einpassen" would use: fits the available width, max 1. */
  fitScale: number
  /** CSS width of the iframe and the design-space wrapper, before scaling. */
  frameWidth: number
  /** On-screen width after scaling (frameWidth * scale). */
  renderedWidth: number
  /** Left edge of the page inside the stage (centred; 0 when it fills). */
  offsetX: number
  /** Top edge of the page inside the stage. */
  offsetY: number
  /** Scrollable width of the stage: the available width, or wider when a
   *  zoomed-in page overflows it (then the stage scrolls horizontally). */
  stageWidth: number
}

/**
 * Zoom of a fixed page: "fit" scales it down to the available width (never
 * up), a number is an explicit scale. Either way the scale stays at most 1.
 */
export type Zoom = "fit" | number

/** The explicit zoom steps the toolbar's −/+ walk through. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1] as const

/**
 * Fixed: the page keeps its design width, scales down evenly to fit a
 * narrower stage (or to the chosen zoom) and is centred in letterbox bands
 * on a wider one. Fill: the iframe takes the stage width at scale 1, so
 * nothing is zoomed and `zoom` is ignored.
 */
export function computeStageLayout(input: {
  display: DisplayMode
  designWidth: number
  availableWidth: number
  zoom?: Zoom
}): StageLayout {
  const available = Math.max(0, input.availableWidth)
  if (input.display === "fill") {
    return {
      scale: 1,
      fitScale: 1,
      frameWidth: available,
      renderedWidth: available,
      offsetX: 0,
      offsetY: 0,
      stageWidth: available,
    }
  }
  const designWidth = input.designWidth > 0 ? input.designWidth : 1
  const fitScale = available > 0 ? Math.min(1, available / designWidth) : 1
  const zoom = input.zoom ?? "fit"
  const scale = zoom === "fit" ? fitScale : clampZoom(zoom)
  const renderedWidth = designWidth * scale
  return {
    scale,
    fitScale,
    frameWidth: designWidth,
    renderedWidth,
    offsetX: Math.max(0, (available - renderedWidth) / 2),
    offsetY: FIXED_PAD_Y,
    stageWidth: Math.max(available, renderedWidth),
  }
}

/** An explicit zoom, kept within the smallest step and 100%. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return clamp(zoom, ZOOM_STEPS[0], 1)
}

/** The next explicit step above (+1) or below (-1) the scale shown now. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const eps = 0.001
  if (direction > 0) {
    return ZOOM_STEPS.find((s) => s > current + eps) ?? 1
  }
  return (
    [...ZOOM_STEPS].reverse().find((s) => s < current - eps) ?? ZOOM_STEPS[0]
  )
}

export interface Point {
  x: number
  y: number
}

/**
 * A pointer position over the scaled page → design pixels.
 * `rect` is the page wrapper's bounding rect (already scaled on screen).
 * Clamped to the page so a click on the very edge never yields a negative.
 */
export function clientToDesign(
  client: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  scale: number
): Point {
  const s = scale > 0 ? scale : 1
  const maxX = rect.width / s
  const maxY = rect.height / s
  const x = clamp((client.clientX - rect.left) / s, 0, maxX)
  const y = clamp((client.clientY - rect.top) / s, 0, maxY)
  return { x: round2(x), y: round2(y) }
}

/** Design pixels → stage-local pixels (where the pin's centre sits on screen). */
export function designToStage(point: Point, layout: StageLayout): Point {
  return {
    x: layout.offsetX + point.x * layout.scale,
    y: layout.offsetY + point.y * layout.scale,
  }
}

export interface PopoverPlacement {
  left: number
  top: number
  side: "right" | "left"
}

/** Paper: the popover's edge sits 12px past the 28px pin (centre + 26). */
export const POPOVER_GAP_X = 26

/**
 * Places a popover beside a pin centre given in stage pixels. It opens to
 * the right of the pin and flips to the left when it would run past the
 * stage's right edge; it never starts left of `margin`.
 * `dy` is the vertical offset from the pin centre (thread +22, composer -14).
 */
export function placePopover(input: {
  anchor: Point
  width: number
  containerWidth: number
  dy: number
  margin?: number
}): PopoverPlacement {
  const margin = input.margin ?? 12
  const right = input.anchor.x + POPOVER_GAP_X
  const top = Math.max(margin, input.anchor.y + input.dy)
  if (right + input.width <= input.containerWidth - margin) {
    return { left: right, top, side: "right" }
  }
  const left = input.anchor.x - POPOVER_GAP_X - input.width
  if (left >= margin) return { left, top, side: "left" }
  // Neither side fits: keep it inside the stage.
  return {
    left: clamp(
      input.containerWidth - margin - input.width,
      margin,
      Number.POSITIVE_INFINITY
    ),
    top,
    side: "right",
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}
