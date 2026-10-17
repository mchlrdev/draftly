import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { typeClass } from "@/lib/type-scale";
import { fontWeights } from "@/lib/font-weight";

// The shell shared by the password gate and the 404 (artboards Passwort,
// Passwort · Fehler, 404): the Draftly wordmark above one centred card on
// the light floor. Server-safe, so not-found.tsx can render it directly.
// The app runs at the compact size step (components/providers.tsx).

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-1 px-4 py-10">
      <div className="flex w-105 max-w-full flex-col items-center pb-5">
        <span
          className={cn(typeClass("body", "compact"), "text-muted-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          Draftly
        </span>
      </div>
      <div className="flex w-105 max-w-full flex-col gap-3 rounded-[14px] bg-card px-9 pt-9 pb-8 shadow-[0_0_0_1px_var(--border),0_1px_3px_rgb(0_0_0/0.06)]">
        {children}
      </div>
    </main>
  );
}

export function CardHeading({ title, subtitle, className }: { title: string; subtitle: string; className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-2 text-center", className)}>
      <h1
        className={cn(typeClass("display", "compact"), "text-foreground text-balance")}
        style={{ fontVariationSettings: fontWeights.semibold }}
      >
        {title}
      </h1>
      <p className={cn(typeClass("subtitle", "compact"), "text-muted-foreground")}>{subtitle}</p>
    </div>
  );
}
