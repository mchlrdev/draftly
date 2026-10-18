"use client"

import { useEffect, useRef, useState, type DragEvent } from "react"
import { AnimatePresence, motion } from "motion/react"
import { semibold } from "@/components/admin/text"
import { dragHasFiles } from "@/lib/admin/files"
import { spring } from "@/lib/springs"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// Drag and drop for page uploads. A drop zone inside a dialog takes files
// dropped on it; the draft page itself takes files dropped anywhere else.
// Only drags that carry files count, so text or links dragged around the
// page are left alone.

/**
 * Handlers for one drop zone, plus whether files are over it. The drop stops
 * there, so the page-wide drop doesn't take the same files again.
 */
export function useDropZone(onFiles: (files: File[]) => void, enabled = true) {
  const [over, setOver] = useState(false)
  // dragenter/dragleave fire for every child crossed; count them.
  const depth = useRef(0)
  const takes = (e: DragEvent) => enabled && dragHasFiles(e.dataTransfer)

  const props = {
    onDragEnter: (e: DragEvent) => {
      if (!takes(e)) return
      e.preventDefault()
      depth.current += 1
      setOver(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!takes(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: (e: DragEvent) => {
      if (!takes(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      if (!takes(e)) return
      e.preventDefault()
      e.stopPropagation()
      depth.current = 0
      setOver(false)
      onFiles(Array.from(e.dataTransfer.files))
    },
  }
  return { over, props }
}

/**
 * The whole window as a drop target while a draft is open. Disabled (a
 * dialog is open), it still refuses the drop, so a file that misses the
 * dialog's zone doesn't make the browser navigate to it.
 */
export function PageDropTarget({
  enabled,
  onFiles,
}: {
  enabled: boolean
  onFiles: (files: File[]) => void
}) {
  const [over, setOver] = useState(false)
  const latest = useRef({ enabled, onFiles })
  useEffect(() => {
    latest.current = { enabled, onFiles }
  })

  useEffect(() => {
    let depth = 0
    const reset = () => {
      depth = 0
      setOver(false)
    }
    const onEnter = (e: globalThis.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return
      depth += 1
      if (latest.current.enabled) setOver(true)
    }
    const onLeave = (e: globalThis.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const onOver = (e: globalThis.DragEvent) => {
      // A drop zone further in has already said yes.
      if (e.defaultPrevented || !dragHasFiles(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = latest.current.enabled ? "copy" : "none"
    }
    // Bubbling drop: a zone that took the files stopped it on the way.
    const onDrop = (e: globalThis.DragEvent) => {
      if (!dragHasFiles(e.dataTransfer) || e.defaultPrevented) return
      e.preventDefault()
      if (latest.current.enabled && e.dataTransfer)
        latest.current.onFiles(Array.from(e.dataTransfer.files))
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("dragover", onOver)
    window.addEventListener("drop", onDrop)
    // Every drop ends the drag, zone or not: reset on the way down.
    window.addEventListener("drop", reset, true)
    window.addEventListener("dragend", reset)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("drop", onDrop)
      window.removeEventListener("drop", reset, true)
      window.removeEventListener("dragend", reset)
    }
  }, [])

  return (
    <AnimatePresence>
      {over && enabled && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: spring.moderate.exit }}
          transition={spring.moderate}
          className="pointer-events-none fixed inset-0 z-50 bg-background/80 p-3 backdrop-blur-[2px]"
        >
          <div className="flex size-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-ring">
            <p
              className={cn(typeClass("title", "compact"), "text-foreground")}
              style={semibold}
            >
              HTML-Dateien hier ablegen
            </p>
            <p
              className={cn(
                typeClass("body", "compact"),
                "text-muted-foreground"
              )}
            >
              Namen, Darstellung und Reihenfolge legst du danach fest.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
