"use client"

import { forwardRef, type ReactNode } from "react"
import { motion } from "motion/react"
import { Elevated } from "@/lib/elevated"
import { spring } from "@/lib/springs"
import { cn } from "@/lib/utils"
import type { PopoverPlacement } from "@/lib/reviewer/geometry"

export const POPOVER_WIDTH = 320

// The card that floats beside a pin (Paper: 320 wide, 16px radius, 16/12
// padding). It lives in the stage's unscaled layer so its text never
// shrinks with a scaled-down page; only its position follows the pin.
export const PopoverShell = forwardRef<
  HTMLDivElement,
  {
    placement: PopoverPlacement
    children: ReactNode
    className?: string
    label: string
  }
>(function PopoverShell({ placement, children, className, label }, ref) {
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="absolute z-20"
      style={{
        left: placement.left,
        top: placement.top,
        width: POPOVER_WIDTH,
        transformOrigin: placement.side === "right" ? "top left" : "top right",
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: spring.fast.exit }}
      transition={spring.fast}
      // Clicks inside must not reach the click overlay underneath.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Elevated
        offset={2}
        shadowLevel={3}
        className={cn("flex flex-col rounded-2xl px-4 pt-4 pb-3", className)}
      >
        {children}
      </Elevated>
    </motion.div>
  )
})
