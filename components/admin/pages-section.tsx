"use client"

import { useState, type KeyboardEvent, type PointerEvent } from "react"
import { useRouter } from "next/navigation"
import { Reorder, useDragControls } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  OperatorDialog,
  CancelButton,
  DangerButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { PageFormDialog } from "@/components/admin/page-form-dialog"
import { EmptyState, semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { designWidthProblem } from "@/lib/admin/format"
import { moveBy, sameOrder } from "@/lib/admin/reorder"
import type { DisplayMode, Draft, Page } from "@/lib/api-types"
import { useSize } from "@/lib/size-context"
import { spring } from "@/lib/springs"
import { SurfaceProvider } from "@/lib/surface-context"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Seiten" of artboard "Draft · Aktionen": upload, replace, delete, display
// mode and design width right on the row (saved on change, optimistic), and
// reorder. Reorder by dragging the grip, or focus the grip and use the arrow
// keys; either way the new order is sent once it settles.
// Rows carry several actions each, so they get no fluid hover (a wrong
// click here would hurt).

export function PagesSection({ draft }: { draft: Draft }) {
  const router = useRouter()
  const serverOrder = draft.pages.map((p) => p.id)
  const [order, setOrder] = useState(serverOrder)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState("")

  // Server data wins whenever it changes (after an upload, delete, refresh).
  const serverKey = serverOrder.join(",")
  const [syncedKey, setSyncedKey] = useState(serverKey)
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey)
    setOrder(serverOrder)
  }

  const byId = new Map(draft.pages.map((p) => [p.id, p]))
  const pages = order
    .map((id) => byId.get(id))
    .filter((p): p is Page => Boolean(p))

  // Upload / replace dialog: one instance per opening, so its fields start fresh.
  const [form, setForm] = useState<{ key: number; page?: Page; open: boolean }>(
    { key: 0, open: false }
  )
  const openForm = (page?: Page) =>
    setForm((f) => ({ key: f.key + 1, page, open: true }))

  const [toDelete, setToDelete] = useState<Page | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const commit = async (next: string[]) => {
    if (sameOrder(next, serverOrder)) return
    setReorderError(null)
    const res = await operatorApi.reorderPages(
      draft.projectSlug,
      draft.slug,
      next
    )
    if (!res.ok) {
      setReorderError(res.error)
      setOrder(serverOrder)
      return
    }
    router.refresh()
  }

  const moveWithKeys = (page: Page, delta: number) => {
    const next = moveBy(order, page.id, delta)
    if (sameOrder(next, order)) return
    setOrder(next)
    setAnnounce(
      `„${page.name}“ ist jetzt an Position ${next.indexOf(page.id) + 1} von ${next.length}.`
    )
    void commit(next)
  }

  const deletePage = async () => {
    if (!toDelete) return
    setDeleting(true)
    const res = await operatorApi.deletePage(
      draft.projectSlug,
      draft.slug,
      toDelete.id
    )
    setDeleting(false)
    if (!res.ok) {
      setDeleteError(res.error)
      return
    }
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <section aria-labelledby="pages-heading" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2
          id="pages-heading"
          className={cn(typeClass("title", "compact"), "text-foreground")}
          style={semibold}
        >
          Seiten
        </h2>
        <Button variant="primary" onClick={() => openForm()}>
          Seite hinzufügen
        </Button>
      </div>

      {pages.length === 0 ? (
        <EmptyState title="Noch keine Seite.">
          Lade eine HTML-Datei hoch. Der Link zeigt die Seiten in dieser
          Reihenfolge.
        </EmptyState>
      ) : (
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="flex flex-col gap-6"
          aria-label="Seiten in Reihenfolge"
        >
          {pages.map((page, i) => (
            <PageRow
              key={page.id}
              page={page}
              projectSlug={draft.projectSlug}
              draftSlug={draft.slug}
              position={i}
              total={pages.length}
              onDrop={() => void commit(order)}
              onMove={(delta) => moveWithKeys(page, delta)}
              onReplace={() => openForm(page)}
              onDelete={() => {
                setToDelete(page)
                setDeleteError(null)
                setDeleteOpen(true)
              }}
            />
          ))}
        </Reorder.Group>
      )}
      {reorderError && <ErrorText>{reorderError}</ErrorText>}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <PageFormDialog
        key={form.key}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        projectSlug={draft.projectSlug}
        draftSlug={draft.slug}
        page={form.page}
      />

      <OperatorDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={toDelete ? `„${toDelete.name}“ löschen?` : "Seite löschen?"}
        description="Die Seite und alle ihre Kommentare sind danach weg."
        onSubmit={deletePage}
        actions={
          <>
            <CancelButton onClick={() => setDeleteOpen(false)} />
            <DangerButton type="submit" loading={deleting}>
              Seite löschen
            </DangerButton>
          </>
        }
      >
        {deleteError && <ErrorText>{deleteError}</ErrorText>}
      </OperatorDialog>
    </section>
  )
}

function PageRow({
  page,
  projectSlug,
  draftSlug,
  position,
  total,
  onDrop,
  onMove,
  onReplace,
  onDelete,
}: {
  page: Page
  projectSlug: string
  draftSlug: string
  position: number
  total: number
  onDrop: () => void
  onMove: (delta: number) => void
  onReplace: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)

  // Display and width save on change. Local state shows the pick at once;
  // a failed save puts the server value back and says why under the row.
  const [display, setDisplay] = useState<DisplayMode>(page.display)
  const [width, setWidth] = useState(String(page.designWidth))
  const [error, setError] = useState<string | null>(null)
  const serverKey = `${page.display}:${page.designWidth}`
  const [syncedKey, setSyncedKey] = useState(serverKey)
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey)
    setDisplay(page.display)
    setWidth(String(page.designWidth))
  }

  const save = async (patch: {
    display?: DisplayMode
    designWidth?: number
  }) => {
    setError(null)
    const res = await operatorApi.updatePage(
      projectSlug,
      draftSlug,
      page.id,
      patch
    )
    if (!res.ok) {
      setDisplay(page.display)
      setWidth(String(page.designWidth))
      setError(res.error)
      return
    }
    router.refresh()
  }

  const changeDisplay = (next: string) => {
    if (next !== "fixed" && next !== "fill") return
    if (next === display) return
    setDisplay(next)
    void save({ display: next })
  }

  const commitWidth = () => {
    const value = width.trim()
    if (value === String(page.designWidth)) return
    const problem = designWidthProblem(value, "fixed")
    if (problem) {
      setError(problem)
      setWidth(String(page.designWidth))
      return
    }
    setWidth(String(Number(value)))
    void save({ designWidth: Number(value) })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      onMove(-1)
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      onMove(1)
    }
  }

  return (
    <Reorder.Item
      value={page.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false)
        onDrop()
      }}
      transition={spring.moderate}
      className={cn(
        "relative flex flex-col rounded-xl bg-card px-4",
        "shadow-[0_0_0_1px_var(--border),0_1px_2px_var(--shadow-color)]",
        dragging && "z-10 shadow-surface-5"
      )}
    >
      <div className="flex h-14 items-center gap-3">
        <button
          type="button"
          aria-label={`„${page.name}“ verschieben, Position ${position + 1} von ${total}. Pfeiltasten hoch und runter.`}
          onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
            e.preventDefault()
            controls.start(e)
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "-ml-1 flex h-7 w-6 shrink-0 touch-none items-center justify-center rounded-md outline-none",
            "transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <Grip />
        </button>
        <span
          className={cn(
            typeClass("subtitle", "compact"),
            "min-w-0 grow truncate text-foreground"
          )}
          style={semibold}
        >
          {page.name}
        </span>
        {/* The row is a card (surface 2): the menu opens a step above it. */}
        <SurfaceProvider value={2}>
          <Select value={display} onValueChange={changeDisplay}>
            <SelectTrigger
              variant="borderless"
              aria-label={`Darstellung von „${page.name}“`}
              className="w-24 min-w-0 shrink-0"
            />
            <SelectContent>
              <SelectItem index={0} value="fixed">
                Fix
              </SelectItem>
              <SelectItem index={1} value="fill">
                Fill
              </SelectItem>
            </SelectContent>
          </Select>
        </SurfaceProvider>
        <span className="flex w-24 shrink-0 items-center gap-1">
          {display === "fixed" && (
            <WidthField
              value={width}
              onChange={setWidth}
              onCommit={commitWidth}
              onCancel={() => setWidth(String(page.designWidth))}
              label={`Designbreite von „${page.name}“ in px`}
            />
          )}
        </span>
        <Button
          variant="ghost"
          className="w-22 shrink-0"
          onClick={onReplace}
          aria-label={`„${page.name}“ ersetzen`}
        >
          Ersetzen
        </Button>
        <Button
          variant="ghost"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`„${page.name}“ löschen`}
        >
          Löschen
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className={cn(
            typeClass("caption", "compact"),
            "-mt-2 pb-3 pl-9 text-destructive"
          )}
        >
          {error}
        </p>
      )}
    </Reorder.Item>
  )
}

/** Design width in px: saves on blur or Enter, Escape puts the saved value back. */
function WidthField({
  value,
  onChange,
  onCommit,
  onCancel,
  label,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  label: string
}) {
  const { field } = useSize()
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            e.preventDefault()
            onCancel()
          }
        }}
        className={cn(
          field,
          "h-7 w-16 rounded-md bg-transparent px-2 text-right text-foreground tabular-nums outline-none",
          "shadow-[inset_0_0_0_1px_var(--border)] transition-colors duration-80 hover:bg-hover",
          "focus-visible:ring-1 focus-visible:ring-focus-ring"
        )}
      />
      <span
        aria-hidden
        className={cn(typeClass("body", "compact"), "text-muted-foreground")}
      >
        px
      </span>
    </>
  )
}

/** The 2×3 dot grip from the artboard. */
function Grip() {
  return (
    <span aria-hidden className="grid grid-cols-2 gap-0.75">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="size-0.75 rounded-xs bg-muted-foreground" />
      ))}
    </span>
  )
}
