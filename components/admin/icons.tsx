"use client"

import type { ComponentType } from "react"
import { Eye, EyeOff, Trash01 } from "@untitledui/icons"
import type { IconComponent, IconComponentProps } from "@/lib/icon-context"

// Untitled UI glyphs the shared icon map has no slot for, adapted to the
// same IconComponent contract (size → width/height) as lib/icons-untitledui.
function adapt(
  Icon: ComponentType<{
    width?: number
    height?: number
    strokeWidth?: number
    className?: string
  }>
): IconComponent {
  return function OperatorIcon({
    size,
    strokeWidth,
    className,
  }: IconComponentProps) {
    return (
      <Icon
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        className={className}
      />
    )
  }
}

export const TrashIcon = adapt(Trash01)
export const EyeIcon = adapt(Eye)
export const EyeOffIcon = adapt(EyeOff)
