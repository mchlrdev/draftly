"use client"

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { motion, useReducedMotion } from "motion/react"
import { spring } from "@/lib/springs"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_KEY_STEP,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/reviewer/sidebar-prefs"

// The column that holds the comments sidebar: it opens and closes by
// animating its width (so the page stage beside it re-fits as it goes) and
// is resized by dragging, or arrowing, the handle on its left edge.
//
// Width is a layout property, which custom-motion.md allows only with the
// reduced-motion gate done by hand: under reduced motion the width snaps and
// only the content's opacity fades. It rides `spring.moderate` because the
// panel must land exactly (a bounce would make the page stage wobble).

/** The gap between the stage and the sidebar; also the stage's right inset
 *  while the sidebar is closed. Holds the resize handle. */
export const SIDEBAR_GUTTER = 8

export const SIDEBAR_ID = "draftly-comments-sidebar"

export function SidebarPanel({
  open,
  width,
  onWidthChange,
  children,
}: {
  open: boolean
  width: number
  onWidthChange: (width: number) => void
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion() ?? false
  const [resizing, setResizing] = useState(false)
  // Stored prefs replace the server defaults right after hydration; that
  // correction lands without animating.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const widthTransition =
    !settled || resizing || reduceMotion
      ? { duration: 0 }
      : open
        ? spring.moderate
        : spring.moderate.exit

  return (
    <motion.div
      className="relative h-full shrink-0 overflow-hidden"
      initial={false}
      animate={{ width: open ? width + SIDEBAR_GUTTER : SIDEBAR_GUTTER }}
      transition={widthTransition}
    >
      <motion.div
        id={SIDEBAR_ID}
        className="absolute inset-y-0 flex"
        style={{ left: SIDEBAR_GUTTER, width }}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={
          !settled ? { duration: 0 } : open ? spring.fast : spring.fast.exit
        }
        inert={!open}
      >
        {children}
      </motion.div>
      {open && (
        <ResizeHandle
          width={width}
          onWidthChange={onWidthChange}
          onResizingChange={setResizing}
        />
      )}
    </motion.div>
  )
}

function ResizeHandle({
  width,
  onWidthChange,
  onResizingChange,
}: {
  width: number
  onWidthChange: (width: number) => void
  onResizingChange: (resizing: boolean) => void
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startWidth: width }
    setDragging(true)
    onResizingChange(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // The handle sits on the sidebar's left edge: moving left widens it.
    onWidthChange(d.startWidth + (d.startX - e.clientX))
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    onResizingChange(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? SIDEBAR_KEY_STEP * 4 : SIDEBAR_KEY_STEP
    let next: number | null = null
    if (e.key === "ArrowLeft") next = width + step
    else if (e.key === "ArrowRight") next = width - step
    else if (e.key === "Home") next = SIDEBAR_MIN_WIDTH
    else if (e.key === "End") next = SIDEBAR_MAX_WIDTH
    else if (e.key === "Enter") next = SIDEBAR_DEFAULT_WIDTH
    if (next === null) return
    e.preventDefault()
    onWidthChange(next)
  }

  // While dragging, the whole window shows the resize cursor and no text
  // gets selected, even where the pointer outruns the handle.
  useEffect(() => {
    if (!dragging) return
    const { style } = document.body
    const prev = { cursor: style.cursor, userSelect: style.userSelect }
    style.cursor = "col-resize"
    style.userSelect = "none"
    return () => {
      style.cursor = prev.cursor
      style.userSelect = prev.userSelect
    }
  }, [dragging])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite der Kommentarspalte"
      aria-controls={SIDEBAR_ID}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      data-dragging={dragging || undefined}
      className="group/handle absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize touch-none outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={() => onWidthChange(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
    >
      {/* The line sits in the middle of the 8px gutter, level with the
          stage's inset, and shows on hover, drag and keyboard focus. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-2 left-[3px] w-0.5 rounded-full opacity-0 transition-[opacity,background-color] duration-80",
          "bg-muted-foreground group-hover/handle:opacity-100",
          "group-focus-visible/handle:bg-focus-ring group-focus-visible/handle:opacity-100",
          "group-data-[dragging]/handle:bg-focus-ring group-data-[dragging]/handle:opacity-100"
        )}
      />
    </div>
  )
}
