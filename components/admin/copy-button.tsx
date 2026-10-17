"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { spring } from "@/lib/springs"
import { fontWeights } from "@/lib/font-weight"

// The installed InputCopy speaks English ("Copy", "Copied") and can't be
// edited, so the German copy buttons are a Button with the same 2000ms
// acknowledgement. The two labels share one grid cell (an invisible sizer
// holds the wider one), so the swap never moves the row; they crossfade
// like an icon swap: enter on the fast tier, leave on its exit token.

const SHOWN = { opacity: 1, filter: "blur(0px)" }
const HIDDEN = { opacity: 0, filter: "blur(2px)" }
const enter = {
  type: "tween" as const,
  duration: spring.fast.duration,
  ease: "easeOut" as const,
}
const leave = {
  type: "tween" as const,
  ...spring.fast.exit,
  ease: "easeIn" as const,
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    area.style.fontSize = "16px"
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand("copy")
    } catch {
      ok = false
    }
    document.body.removeChild(area)
    return ok
  }
}

interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** The text that lands on the clipboard. */
  text: string
  label?: string
  copiedLabel?: string
  /** Accessible name, e.g. "Link kopieren". */
  "aria-label"?: string
}

export function CopyButton({
  text,
  label = "Kopieren",
  copiedLabel = "Kopiert",
  variant = "tertiary",
  style,
  ...props
}: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const onClick = useCallback(async () => {
    const ok = await copyText(text)
    setStatus(ok ? "copied" : "error")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setStatus("idle"), 2000)
  }, [text])

  const done = status !== "idle"
  const doneLabel = status === "error" ? "Fehlgeschlagen" : copiedLabel

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      style={{ fontVariationSettings: fontWeights.semibold, ...style }}
      {...props}
    >
      <span className="inline-grid">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {label.length >= doneLabel.length ? label : doneLabel}
        </span>
        <motion.span
          className="col-start-1 row-start-1 text-center"
          initial={false}
          animate={done ? HIDDEN : SHOWN}
          transition={done ? leave : enter}
          aria-hidden={done}
        >
          {label}
        </motion.span>
        <motion.span
          className="col-start-1 row-start-1 text-center"
          initial={false}
          animate={done ? SHOWN : HIDDEN}
          transition={done ? enter : leave}
          aria-hidden={!done}
        >
          {doneLabel}
        </motion.span>
      </span>
      <span className="sr-only" aria-live="polite">
        {status === "copied"
          ? "In die Zwischenablage kopiert"
          : status === "error"
            ? "Kopieren fehlgeschlagen"
            : ""}
      </span>
    </Button>
  )
}
