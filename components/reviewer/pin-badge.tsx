"use client"

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react"
import { cn } from "@/lib/utils"
import { useSize } from "@/lib/size-context"
import { fontWeights } from "@/lib/font-weight"

// The numbered 28px circle used for pins on the page, in sidebar rows and in
// popover headers (Paper: #171717 fill for open, an outlined white disc for
// resolved). `as="button"` makes it a pin on the page.

const base =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full tabular-nums"

const tones = {
  open: "bg-primary text-primary-foreground",
  resolved:
    "bg-background text-muted-foreground shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_18%,transparent)]",
}

// Pins on the page sit on the draft's own pixels, not on the app's surfaces,
// so they don't follow the app theme: a design is as light or dark in dark
// mode as it is in light mode. Paper's dark disc / white disc in both themes,
// each with a halo in the opposite tone so it holds on light and dark pages.
const pageTones = {
  open: "bg-neutral-900 text-neutral-50 shadow-[0_0_0_1.5px_rgb(255_255_255/0.9),0_2px_8px_rgb(0_0_0/0.28)]",
  resolved:
    "bg-white text-neutral-500 shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.18),0_2px_8px_rgb(0_0_0/0.22)]",
}

export function PinNumber({
  number,
  resolved,
  className,
}: {
  number: number
  resolved?: boolean
  className?: string
}) {
  const size = useSize()
  return (
    <span
      aria-hidden
      className={cn(
        base,
        size.type.body,
        resolved ? tones.resolved : tones.open,
        className
      )}
      style={{ fontVariationSettings: fontWeights.semibold }}
    >
      {number}
    </span>
  )
}

interface PinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  number: number
  resolved?: boolean
  active?: boolean
}

/** A pin on the page. Positioned by the caller (left/top at the design point). */
export const PinButton = forwardRef<HTMLButtonElement, PinButtonProps>(
  function PinButton(
    { number, resolved, active, className, style, ...props },
    ref
  ) {
    const size = useSize()
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          base,
          size.type.body,
          "cursor-pointer transition-shadow duration-80 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
          resolved ? pageTones.resolved : pageTones.open,
          active && "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white",
          className
        )}
        style={{ fontVariationSettings: fontWeights.semibold, ...style }}
        {...props}
      >
        {number}
      </button>
    )
  }
)

/** The pin being placed while the composer is open (Paper "Pin neu"). */
export function DraftPin({ style }: { style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none flex size-7 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_2px_var(--color-neutral-900),0_2px_8px_rgb(0_0_0/0.28)]"
      style={style}
    >
      <span className="size-2 rounded-full bg-neutral-900" />
    </span>
  )
}
