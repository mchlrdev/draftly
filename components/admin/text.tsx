// Shared type and surface recipes for the operator pages. No "use client":
// server and client components both render these.
//
// Content text uses the default step of the type ladder (display 28, title 16,
// subtitle 14, body 13, caption 12) to stay close to the Paper artboards; the
// controls around it follow the app's compact size.

import Link from "next/link"
import type { ReactNode } from "react"
import { typeClass } from "@/lib/type-scale"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"

export const semibold = { fontVariationSettings: fontWeights.semibold } as const
export const normal = { fontVariationSettings: fontWeights.normal } as const

/** White card on a 1px border ring with a hairline drop, 14px corners. */
export const cardClass =
  "rounded-[14px] bg-card shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.04)]"

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className={cn(typeClass("display", "compact"), "text-foreground")}
      style={semibold}
    >
      {children}
    </h1>
  )
}

export interface Crumb {
  label: string
  href?: string
}

/** "project-name" above a page title. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Pfad"
      className={cn(typeClass("body", "compact"), "text-muted-foreground")}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-sm transition-colors duration-80 outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Title block plus a trailing action, bottom-aligned like the artboards. */
export function PageHeader({
  crumbs,
  title,
  action,
}: {
  crumbs?: Crumb[]
  title: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {crumbs && <Crumbs items={crumbs} />}
        <PageTitle>{title}</PageTitle>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/** Dashed empty-state card ("Noch kein Projekt."). */
export function EmptyState({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[14px] border border-dashed border-border px-8 py-14">
      <p
        className={cn(typeClass("title", "compact"), "text-foreground")}
        style={semibold}
      >
        {title}
      </p>
      <p
        className={cn(
          typeClass("body", "compact"),
          "max-w-105 text-muted-foreground"
        )}
      >
        {children}
      </p>
    </div>
  )
}

/** Explanation on the left, destructive action on the right. */
export function DangerZone({
  text,
  children,
}: {
  text: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 pt-9">
      <p className={cn(typeClass("body", "compact"), "text-muted-foreground")}>
        {text}
      </p>
      {children}
    </div>
  )
}
