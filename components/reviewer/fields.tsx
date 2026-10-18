"use client"

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import { cn } from "@/lib/utils"
import { useShape } from "@/lib/shape-context"
import { fieldTouchClass, useSize } from "@/lib/size-context"
import { fontWeights } from "@/lib/font-weight"

// The always-framed text fields inside popovers (Paper: 1px input ring at
// rest, a darker ring with a soft halo while focused). Unlike InputGroup's
// frameless-at-rest fields, these sit on a white card and must read as
// fields without a hover. Height follows the size ladder.

const frame =
  "w-full bg-background text-foreground placeholder:text-muted-foreground outline-none transition-shadow duration-80 " +
  "shadow-[inset_0_0_0_1px_var(--input)] focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_var(--border)] " +
  "disabled:opacity-60"

export const FramedInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function FramedInput({ className, style, ...props }, ref) {
  const size = useSize()
  const shape = useShape()
  return (
    <input
      ref={ref}
      className={cn(
        frame,
        shape.input,
        size.control,
        size.px,
        size.field,
        className
      )}
      style={{ fontVariationSettings: fontWeights.normal, ...style }}
      {...props}
    />
  )
})

export const FramedTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function FramedTextarea({ className, style, ...props }, ref) {
  const size = useSize()
  const shape = useShape()
  return (
    <textarea
      ref={ref}
      className={cn(
        frame,
        shape.input,
        size.px,
        "block [field-sizing:content] max-h-60 resize-none py-2",
        size.type.subtitle,
        // after the role, so touch screens still get 16px (no iOS zoom)
        fieldTouchClass,
        className
      )}
      style={{ fontVariationSettings: fontWeights.normal, ...style }}
      {...props}
    />
  )
})
