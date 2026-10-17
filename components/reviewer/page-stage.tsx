"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import { AnimatePresence } from "motion/react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Page } from "@/lib/api-types"
import {
  clientToDesign,
  computeStageLayout,
  designToStage,
  placePopover,
  type Point,
} from "@/lib/reviewer/geometry"
import { reviewerApi } from "@/lib/reviewer/api"
import { DraftPin, PinButton } from "@/components/reviewer/pin-badge"
import { POPOVER_WIDTH } from "@/components/reviewer/popover-shell"
import { ThreadPopover } from "@/components/reviewer/thread-popover"
import { ComposerPopover } from "@/components/reviewer/composer-popover"
import { useViewer } from "@/components/reviewer/viewer-context"
import type { NumberedThread } from "@/components/reviewer/comments-sidebar"

// The page area: the uploaded HTML in a script-less sandboxed iframe, sized
// and scaled by lib/reviewer/geometry, with the click overlay and pins in the
// same scaled wrapper so their x/y are design pixels. Popovers sit in the
// unscaled layer beside it, so their text never shrinks with the page.

// Paper: thread popover top = pin centre + 22, composer top = pin centre - 14.
const THREAD_DY = 22
const COMPOSER_DY = -14

export function PageStage({
  page,
  letterbox,
  pins,
  openThread,
  composer,
  onPlace,
  onOpenThread,
  onCloseThread,
  onComposerDone,
  onComposerCancel,
  onComposerDraftChange,
}: {
  page: Page
  letterbox: string
  /** Pins to show (already filtered); the open thread is always included. */
  pins: NumberedThread[]
  openThread: NumberedThread | null
  composer: Point | null
  onPlace: (point: Point) => void
  onOpenThread: (threadId: string) => void
  onCloseThread: () => void
  onComposerDone: (threadId: string) => void
  onComposerCancel: () => void
  onComposerDraftChange: (hasText: boolean) => void
}) {
  const { draftRef } = useViewer()
  const rootRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  const frameKey = `${page.id}:${page.updatedAt}`
  const frameKeyRef = useRef(frameKey)
  useEffect(() => {
    frameKeyRef.current = frameKey
  })
  // Measured document height, tagged with the page it belongs to so a page
  // switch never borrows the previous page's height.
  const [measured, setMeasured] = useState<{
    key: string
    height: number
  } | null>(null)
  const contentHeight = measured?.key === frameKey ? measured.height : null

  // The stage's inner width (what the page may use) and visible height.
  useLayoutEffect(() => {
    const sizer = sizerRef.current
    const root = rootRef.current
    if (!sizer || !root) return
    const measure = () =>
      setAvailable((prev) => {
        const next = { width: sizer.clientWidth, height: root.clientHeight }
        return prev.width === next.width && prev.height === next.height
          ? prev
          : next
      })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(sizer)
    ro.observe(root)
    return () => ro.disconnect()
  }, [])

  const layout = computeStageLayout({
    display: page.display,
    designWidth: page.designWidth,
    availableWidth: available.width,
  })

  // Fill pages reach at least to the bottom of the stage, like the artboard.
  const minFrameHeight = page.display === "fill" ? available.height : 0
  const frameHeight = Math.max(
    contentHeight ?? available.height,
    minFrameHeight,
    1
  )
  const scaledHeight = frameHeight * layout.scale
  const stageHeight = layout.offsetY * 2 + scaledHeight

  // Height of the uploaded document. Same origin (sandbox allow-same-origin),
  // so the parent can read it; no script ever runs inside the frame.
  const measureFrame = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc?.documentElement) return
    const h = Math.ceil(
      Math.max(
        doc.documentElement.getBoundingClientRect().height,
        doc.body?.scrollHeight ?? 0
      )
    )
    if (h <= 0) return
    const key = frameKeyRef.current
    setMeasured((prev) =>
      prev?.key === key && prev.height === h ? prev : { key, height: h }
    )
  }, [])

  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // A frame that finished loading before hydration never fires onLoad for
  // React: pick it up here.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument
    if (doc?.readyState === "complete" && doc.location.href !== "about:blank") {
      frameKeyRef.current = frameKey
      setLoadedKey(frameKey)
      measureFrame()
    }
  }, [frameKey, measureFrame])

  useEffect(() => {
    if (loadedKey !== frameKey) return
    const doc = frameRef.current?.contentDocument
    if (!doc?.documentElement) return
    // Late images and font swaps change the height after load.
    const ro = new ResizeObserver(() => measureFrame())
    ro.observe(doc.documentElement)
    if (doc.body) ro.observe(doc.body)
    return () => ro.disconnect()
  }, [loadedKey, frameKey, measureFrame])

  // A fill page re-wraps when the width changes.
  useEffect(() => {
    if (loadedKey === frameKey) measureFrame()
  }, [layout.frameWidth, loadedKey, frameKey, measureFrame])

  // Bring the open thread's pin into view (sidebar click on a far-down pin).
  useEffect(() => {
    if (!openThread) return
    const pin = rootRef.current?.querySelector<HTMLElement>(
      `[data-thread-id="${openThread.thread.id}"]`
    )
    pin?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    })
  }, [openThread?.thread.id]) // eslint-disable-line react-hooks/exhaustive-deps -- only when a different thread opens

  function onOverlayClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    onPlace(clientToDesign(e, rect, layout.scale))
  }

  const ready = loadedKey === frameKey && available.width > 0
  const counterScale = layout.scale > 0 ? 1 / layout.scale : 1
  const pinStyle = (p: Point) => ({
    left: p.x,
    top: p.y,
    transform: `translate(-50%, -50%) scale(${counterScale})`,
  })

  const threadPlacement =
    openThread &&
    placePopover({
      anchor: designToStage(openThread.thread, layout),
      width: POPOVER_WIDTH,
      containerWidth: available.width,
      dy: THREAD_DY,
    })
  const composerPlacement =
    composer &&
    placePopover({
      anchor: designToStage(composer, layout),
      width: POPOVER_WIDTH,
      containerWidth: available.width,
      dy: COMPOSER_DY,
    })

  return (
    <div
      ref={rootRef}
      className="relative min-h-0 min-w-0 flex-1"
      style={{ backgroundColor: letterbox }}
    >
      <ScrollArea className="absolute inset-0">
        <div
          ref={sizerRef}
          className="relative w-full"
          style={{ height: stageHeight }}
        >
          <div
            className="absolute overflow-hidden"
            style={{
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.renderedWidth,
              height: scaledHeight,
              borderRadius: page.display === "fixed" ? 2 : 0,
            }}
          >
            <div
              className="relative origin-top-left"
              style={{
                width: layout.frameWidth,
                height: frameHeight,
                transform:
                  layout.scale === 1 ? undefined : `scale(${layout.scale})`,
              }}
            >
              <iframe
                key={frameKey}
                ref={frameRef}
                title={page.name}
                src={reviewerApi.pageHtmlUrl(draftRef, page.id, page.updatedAt)}
                // Same origin so the height can be read; no allow-scripts.
                sandbox="allow-same-origin"
                tabIndex={-1}
                className="absolute inset-0 block size-full border-0 bg-background transition-opacity duration-160"
                style={{ opacity: ready ? 1 : 0 }}
                onLoad={() => {
                  frameKeyRef.current = frameKey
                  setLoadedKey(frameKey)
                  measureFrame()
                }}
              />
              {/* Click overlay: the page never receives pointer events. */}
              <div
                aria-label="Design. Klicken, um einen Pin zu setzen."
                className="absolute inset-0 cursor-crosshair"
                onClick={onOverlayClick}
              />
              {pins.map(({ thread, number }) => (
                <PinButton
                  key={thread.id}
                  data-thread-id={thread.id}
                  number={number}
                  resolved={thread.status === "resolved"}
                  active={openThread?.thread.id === thread.id}
                  aria-label={`Kommentar ${number} öffnen`}
                  className="absolute z-10"
                  style={pinStyle(thread)}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (openThread?.thread.id === thread.id) onCloseThread()
                    else onOpenThread(thread.id)
                  }}
                />
              ))}
              {composer && (
                <DraftPin
                  style={{
                    position: "absolute",
                    zIndex: 10,
                    ...pinStyle(composer),
                  }}
                />
              )}
            </div>
          </div>

          <AnimatePresence>
            {openThread && threadPlacement && (
              <ThreadPopover
                key={`t-${openThread.thread.id}`}
                thread={openThread.thread}
                number={openThread.number}
                placement={threadPlacement}
                onClose={onCloseThread}
              />
            )}
            {composer && composerPlacement && (
              <ComposerPopover
                key={`c-${composer.x}-${composer.y}`}
                placement={composerPlacement}
                pageId={page.id}
                point={composer}
                onDone={onComposerDone}
                onCancel={onComposerCancel}
                onDraftChange={onComposerDraftChange}
              />
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
