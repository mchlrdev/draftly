"use client"

import { useRef } from "react"
import { Tabs, TabsList, TabItem } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FluidHoverHighlight } from "@/components/fluid-hover-highlight"
import {
  useFluidHover,
  useRegisterFluidHoverItem,
} from "@/hooks/use-fluid-hover"
import { useSize } from "@/lib/size-context"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"
import type { Thread, ThreadStatus } from "@/lib/api-types"
import { relativeTime, useNow } from "@/lib/reviewer/time"
import { PinNumber } from "@/components/reviewer/pin-badge"
import { DELETED_TEXT } from "@/components/reviewer/thread-popover"

// The right column "Kommentare" (artboards Viewer, Erledigt, Leer): count,
// Offen/Erledigt filter, the page's threads numbered as on the pins, and the
// hint. One fluid hover highlight glides over the rows.

export interface NumberedThread {
  thread: Thread
  number: number
}

export function CommentsSidebar({
  rows,
  openCount,
  pageHasThreads,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  composing,
}: {
  rows: NumberedThread[]
  openCount: number
  pageHasThreads: boolean
  filter: ThreadStatus
  onFilterChange: (filter: ThreadStatus) => void
  selectedId: string | null
  onSelect: (threadId: string) => void
  composing: boolean
}) {
  const size = useSize()
  const listRef = useRef<HTMLDivElement>(null)
  const hover = useFluidHover(listRef, { axis: "y" })

  const hint = composing
    ? "Enter zum Pinnen · Esc zum Verwerfen"
    : "Auf das Design klicken, um zu pinnen."

  return (
    <aside
      aria-label="Kommentare"
      className="flex min-w-0 flex-1 flex-col gap-4 bg-background py-4 pr-4 pl-2"
    >
      <div className="flex items-center justify-between">
        <h2
          className={cn(size.type.title, "text-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          Kommentare
        </h2>
        <span className={cn(size.type.body, "text-muted-foreground")}>
          {openCount === 0 ? "Keine offen" : `${openCount} offen`}
        </span>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => onFilterChange(v as ThreadStatus)}
      >
        <TabsList className="w-full">
          <TabItem
            value="open"
            label="Offen"
            className="flex-1 justify-center"
          />
          <TabItem
            value="resolved"
            label="Erledigt"
            className="flex-1 justify-center"
          />
        </TabsList>
      </Tabs>

      <ScrollArea className="-mx-2 min-h-0 flex-1">
        <div className="px-2 pb-4">
          {!pageHasThreads ? (
            <EmptyState
              title="Noch keine Kommentare auf dieser Seite."
              text="Auf eine Stelle im Design klicken, um einen Pin mit Kommentar zu setzen."
            />
          ) : rows.length === 0 ? (
            filter === "open" ? (
              <EmptyState
                title="Alles erledigt."
                text="Erledigte Kommentare stehen unter „Erledigt“."
              />
            ) : (
              <EmptyState
                title="Noch nichts erledigt."
                text="Erledigte Kommentare erscheinen hier."
              />
            )
          ) : (
            <>
              <div
                ref={listRef}
                {...hover.handlers}
                className="relative -mx-2 flex flex-col gap-4"
              >
                <FluidHoverHighlight hover={hover} className="rounded-xl" />
                {rows.map(({ thread, number }, i) => (
                  <ThreadRow
                    key={thread.id}
                    index={i}
                    registerItem={hover.registerItem}
                    thread={thread}
                    number={number}
                    selected={thread.id === selectedId}
                    onSelect={() => onSelect(thread.id)}
                  />
                ))}
              </div>
              <p className={cn(size.type.body, "pt-6 text-muted-foreground")}>
                {hint}
              </p>
            </>
          )}
          {!pageHasThreads && composing && (
            <p className={cn(size.type.body, "pt-4 text-muted-foreground")}>
              {hint}
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  const size = useSize()
  return (
    <div className="flex flex-col gap-1.5 pt-6">
      <p
        className={cn(size.type.title, "text-foreground")}
        style={{ fontVariationSettings: fontWeights.semibold }}
      >
        {title}
      </p>
      <p className={cn(size.type.subtitle, "text-muted-foreground")}>{text}</p>
    </div>
  )
}

function ThreadRow({
  index,
  registerItem,
  thread,
  number,
  selected,
  onSelect,
}: {
  index: number
  registerItem: (index: number, el: HTMLElement | null) => void
  thread: Thread
  number: number
  selected: boolean
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useRegisterFluidHoverItem(registerItem, index, ref)
  const size = useSize()
  const now = useNow()

  const [first, ...replies] = thread.comments
  const resolved = thread.status === "resolved"
  const replyCount = replies.filter((c) => !c.deletedAt).length
  const meta = [
    replyCount > 0
      ? replyCount === 1
        ? "1 Antwort"
        : `${replyCount} Antworten`
      : null,
    resolved ? "Erledigt" : null,
    resolved && thread.resolvedAt && now !== null
      ? relativeTime(thread.resolvedAt, now)
      : null,
  ].filter(Boolean)

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full cursor-pointer gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-80 outline-none",
        "focus-visible:ring-2 focus-visible:ring-focus-ring",
        selected && "bg-muted"
      )}
    >
      <PinNumber number={number} resolved={resolved} />
      <span className="flex min-w-0 grow flex-col gap-1">
        <span
          className={cn(size.type.body, "truncate text-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {first?.authorName}
        </span>
        <span
          className={cn(
            size.type.subtitle,
            "line-clamp-3 break-words",
            resolved || first?.deletedAt
              ? "text-muted-foreground"
              : "text-foreground"
          )}
        >
          {first?.deletedAt ? DELETED_TEXT : first?.body}
        </span>
        {meta.length > 0 && (
          <span
            className={cn(size.type.caption, "pt-0.5 text-muted-foreground")}
          >
            {meta.join(" · ")}
          </span>
        )}
      </span>
    </button>
  )
}
