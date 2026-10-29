import "server-only"

import { chromium, type Browser } from "playwright-core"
import { HttpError } from "./http"

// Screenshots of uploaded pages for agents (ADR 0004 amendment), for pages
// without a Paper link or when a rendered view is simpler. One headless
// Chromium shell, started on demand and closed after a minute idle, renders
// one page at a time. The page gets no JavaScript and no network: only data:
// URLs load, so uploaded HTML cannot reach anything from the server.
// Pins are drawn into the HTML before rendering, as plain positioned divs.

const IDLE_MS = 60_000
const RENDER_TIMEOUT_MS = 20_000
/** Wider pages are scaled down so the image stays readable for a model. */
const MAX_IMAGE_WIDTH = 1600
/** Chromium's texture limit is ~16k; stay well under it per shot. */
export const MAX_CLIP_HEIGHT = 3000

export interface PinMark {
  number: number
  x: number
  y: number
  resolved: boolean
  /** The thread the shot is about: drawn with a ring. */
  focus?: boolean
}

export interface Clip {
  x: number
  y: number
  width: number
  height: number
}

let browser: Promise<Browser> | null = null
let idle: ReturnType<typeof setTimeout> | null = null
let queue: Promise<unknown> = Promise.resolve()

function launch(): Promise<Browser> {
  // Docker gives /dev/shm 64 MB; tall pages would crash the renderer there.
  browser ??= chromium
    .launch({ headless: true, args: ["--disable-dev-shm-usage"] })
    .catch((err: unknown) => {
      browser = null
      console.error(err)
      throw new HttpError(
        503,
        "Screenshots sind auf diesem Server nicht verfügbar (kein Browser installiert)."
      )
    })
  return browser
}

function scheduleClose() {
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => {
    const b = browser
    browser = null
    void b?.then((x) => x.close()).catch(() => {})
  }, IDLE_MS)
  idle.unref?.()
}

/** One render at a time keeps memory to one tab. */
function serialized<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job)
  queue = run.catch(() => {})
  return run
}

const PIN_SIZE = 28

function pinOverlay(pins: PinMark[]): string {
  const marks = pins
    .map((p) => {
      const fill = p.resolved
        ? "background:#fff;color:#737373"
        : "background:#171717;color:#fafafa"
      const ring = p.focus
        ? "box-shadow:0 0 0 2px #fff,0 0 0 5px #e5484d,0 2px 8px rgba(0,0,0,.35)"
        : "box-shadow:0 0 0 1.5px rgba(255,255,255,.9),0 2px 8px rgba(0,0,0,.3)"
      return `<div style="position:absolute;left:${p.x - PIN_SIZE / 2}px;top:${p.y - PIN_SIZE / 2}px;width:${PIN_SIZE}px;height:${PIN_SIZE}px;border-radius:50%;${fill};${ring};font:600 13px/${PIN_SIZE}px -apple-system,system-ui,sans-serif;text-align:center">${p.number}</div>`
    })
    .join("")
  return `<div aria-hidden="true" style="position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none">${marks}</div>`
}

function withOverlay(html: string, pins: PinMark[]): string {
  if (!pins.length) return html
  const overlay = pinOverlay(pins)
  const end = html.toLowerCase().lastIndexOf("</body>")
  return end < 0
    ? html + overlay
    : html.slice(0, end) + overlay + html.slice(end)
}

/**
 * Renders `html` at `width` CSS px and returns a JPEG of `clip` (design px,
 * clamped to the page). `clip` gets the page height so callers can pick it
 * from the real size.
 */
export function screenshotPage(
  html: string,
  {
    width,
    pins = [],
    clip,
  }: {
    width: number
    pins?: PinMark[]
    clip: (pageHeight: number) => Clip
  }
): Promise<{ jpeg: Buffer; clip: Clip; pageHeight: number; scale: number }> {
  return serialized(async () => {
    const b = await launch()
    const scale = Math.min(1, MAX_IMAGE_WIDTH / width)
    const context = await b.newContext({
      javaScriptEnabled: false,
      // A short viewport, so scrollHeight is the page's own height, not
      // the window's; the shot itself is taken from the full page.
      viewport: { width, height: 100 },
      deviceScaleFactor: scale,
    })
    try {
      await context.route("**/*", (route) =>
        route.request().url().startsWith("data:")
          ? route.continue()
          : route.abort()
      )
      const page = await context.newPage()
      page.setDefaultTimeout(RENDER_TIMEOUT_MS)
      await page.setContent(withOverlay(html, pins), { waitUntil: "load" })
      const pageHeight = await page.evaluate(
        () => document.documentElement.scrollHeight
      )
      const wanted = clip(pageHeight)
      const x = clamp(Math.round(wanted.x), 0, width - 1)
      const y = clamp(Math.round(wanted.y), 0, Math.max(0, pageHeight - 1))
      const area = {
        x,
        y,
        width: clamp(Math.round(wanted.width), 1, width - x),
        height: clamp(
          Math.round(wanted.height),
          1,
          Math.min(MAX_CLIP_HEIGHT, pageHeight - y)
        ),
      }
      const jpeg = await page.screenshot({
        clip: area,
        fullPage: true,
        type: "jpeg",
        quality: 80,
      })
      return { jpeg, clip: area, pageHeight, scale }
    } finally {
      await context.close().catch(() => {})
      scheduleClose()
    }
  })
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max))
