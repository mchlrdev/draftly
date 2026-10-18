"use client"

import type { KeyboardEvent } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import type { DisplayMode } from "@/lib/api-types"
import { cn } from "@/lib/utils"

// Pieces a page row shares, on the draft page and in "Seiten hinzufügen":
// the grip, the compact inline text field and the Fix/Fill select.

/** The 2×3 dot grip from the artboard. */
export function Grip() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-0.75">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="size-0.75 rounded-xs bg-muted-foreground" />
      ))}
    </span>
  )
}

/** The grip button's frame; pass the dragging state for the cursor. */
export function gripClass(dragging: boolean) {
  return cn(
    "-ml-1 flex h-7 w-6 shrink-0 touch-none items-center justify-center rounded-md outline-none",
    "transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    dragging ? "cursor-grabbing" : "cursor-grab"
  )
}

/** −1 / +1 for the arrow keys that move a row, 0 for anything else. */
export function arrowDelta(e: KeyboardEvent): number {
  if (e.key === "ArrowUp" || e.key === "ArrowLeft") return -1
  if (e.key === "ArrowDown" || e.key === "ArrowRight") return 1
  return 0
}

/** A 28px text field that sits inside a row; add the size recipe's `field`. */
export const inlineFieldClass = cn(
  "h-7 rounded-md bg-background px-2 text-foreground outline-none",
  "shadow-[inset_0_0_0_1px_var(--input)] transition-shadow duration-80 hover:shadow-[inset_0_0_0_1px_var(--ring)]",
  "focus-visible:ring-1 focus-visible:ring-focus-ring",
  "disabled:pointer-events-none disabled:opacity-50"
)

export function DisplaySelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: DisplayMode
  onChange: (value: DisplayMode) => void
  label: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next: string) => {
        if ((next === "fixed" || next === "fill") && next !== value)
          onChange(next)
      }}
    >
      <SelectTrigger aria-label={label} className="w-24 min-w-0 shrink-0" />
      <SelectContent>
        <SelectItem index={0} value="fixed">
          Fix
        </SelectItem>
        <SelectItem index={1} value="fill">
          Fill
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
