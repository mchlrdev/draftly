import { typeClass } from "@/lib/type-scale";
import { fontWeights } from "@/lib/font-weight";
import { cn } from "@/lib/utils";

// The small "DRAFTLY" wordmark from the artboards. FF keeps body text out of
// uppercase and tracking; this is the brand mark the Paper file sets that way.
export function BrandLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(typeClass("body", "compact"), "uppercase tracking-[0.08em] text-muted-foreground", className)}
      style={{ fontVariationSettings: fontWeights.semibold }}
    >
      Draftly
    </span>
  );
}
