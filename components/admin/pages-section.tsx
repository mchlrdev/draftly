"use client"

import { useState, type KeyboardEvent, type PointerEvent } from "react"
import { useRouter } from "next/navigation"
import { Reorder, useDragControls } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  OperatorDialog,
  CancelButton,
  DangerButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { PageFormDialog } from "@/components/admin/page-form-dialog"
import { EmptyState, semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { displayLabel } from "@/lib/admin/format"
import { moveBy, sameOrder } from "@/lib/admin/reorder"
import type { Draft, Page } from "@/lib/api-types"
import { spring } from "@/lib/springs"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Seiten" of artboard "Draft · Aktionen": upload, replace, delete, and
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
          HTML laden
        </Button>
      </div>

      {pages.length === 0 ? (
        <EmptyState title="Noch keine Seite.">
          Lade eine HTML-Datei mit eingebetteten Styles und Bildern hoch. Der
          Link zeigt die Seiten in dieser Reihenfolge.
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
        description="Die Seite und alle Kommentare darauf sind weg. Das lässt sich nicht rückgängig machen."
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
  position,
  total,
  onDrop,
  onMove,
  onReplace,
  onDelete,
}: {
  page: Page
  position: number
  total: number
  onDrop: () => void
  onMove: (delta: number) => void
  onReplace: () => void
  onDelete: () => void
}) {
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)

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
        "relative flex h-14 items-center gap-3 rounded-xl bg-card px-4",
        "shadow-[0_0_0_1px_var(--border),0_1px_2px_rgb(0_0_0/0.04)]",
        dragging &&
          "z-10 shadow-[0_0_0_1px_var(--border),0_8px_24px_rgb(0_0_0/0.10)]"
      )}
    >
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
          "transition-colors duration-80 hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
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
      <span
        className={cn(
          typeClass("body", "compact"),
          "w-22 shrink-0 text-muted-foreground"
        )}
      >
        {displayLabel(page)}
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
    </Reorder.Item>
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
