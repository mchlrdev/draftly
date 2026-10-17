"use client"

import { useRef } from "react"
import Link from "next/link"
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/hooks/use-fluid-hover"
import { FluidHoverHighlight } from "@/components/fluid-hover-highlight"
import { typeClass } from "@/lib/type-scale"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"

// Projects on /admin and drafts on /admin/[project]: each row is one link
// card. One fluid hover highlight glides between the cards; the card itself
// is transparent so the highlight shows through, its border ring and
// hairline drop stay on top.

export interface LinkCardItem {
  key: string
  href: string
  title: string
  meta: string
}

export function LinkCardList({
  items,
  label,
}: {
  items: LinkCardItem[]
  label: string
}) {
  const containerRef = useRef<HTMLUListElement>(null)
  const hover = useFluidHover(containerRef, { axis: "y" })

  return (
    <ul
      ref={containerRef}
      {...hover.handlers}
      aria-label={label}
      className="relative flex flex-col gap-3"
    >
      <FluidHoverHighlight hover={hover} className="rounded-[14px]" />
      {items.map((item, i) => (
        <LinkCard
          key={item.key}
          index={i}
          registerItem={hover.registerItem}
          activeIndex={hover.activeIndex}
          href={item.href}
          title={item.title}
          meta={item.meta}
        />
      ))}
    </ul>
  )
}

function LinkCard({
  index,
  registerItem,
  activeIndex,
  href,
  title,
  meta,
}: Omit<LinkCardItem, "key"> & {
  index: number
  registerItem: (index: number, el: HTMLElement | null) => void
  activeIndex: number | null
}) {
  const ref = useRef<HTMLLIElement>(null)
  useRegisterFluidHoverItem(registerItem, index, ref)
  const lit = activeIndex === index

  return (
    <li ref={ref} className="relative">
      <Link
        href={href}
        className={cn(
          "flex h-18 items-center gap-4 rounded-[14px] px-5 outline-none",
          "shadow-[0_0_0_1px_var(--border),0_1px_2px_var(--shadow-color)]",
          "focus-visible:ring-1 focus-visible:ring-focus-ring"
        )}
      >
        <span className="flex min-w-0 grow flex-col gap-1">
          <span
            className={cn(
              typeClass("title", "compact"),
              "truncate text-foreground"
            )}
            style={{ fontVariationSettings: fontWeights.semibold }}
          >
            {title}
          </span>
          <span
            className={cn(
              typeClass("body", "compact"),
              "truncate text-muted-foreground"
            )}
          >
            {meta}
          </span>
        </span>
        <span
          className={cn(
            typeClass("body", "compact"),
            "shrink-0 transition-colors duration-80",
            lit ? "text-foreground" : "text-muted-foreground"
          )}
        >
          Öffnen
        </span>
      </Link>
    </li>
  )
}
