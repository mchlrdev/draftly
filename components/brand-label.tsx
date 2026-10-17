import { typeClass } from "@/lib/type-scale"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"

// The small "DRAFTLY" wordmark from the artboards, shared by the operator and
// reviewer UIs. FF keeps text out of uppercase and tracking; this brand mark
// follows the Paper file on purpose (operator decision).
export function BrandLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        typeClass("body", "compact"),
        "tracking-[0.08em] text-muted-foreground uppercase",
        className
      )}
      style={{ fontVariationSettings: fontWeights.semibold }}
    >
      Draftly
    </span>
  )
}
