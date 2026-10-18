"use client"

import { useRef, useState, type PointerEvent } from "react"
import { useRouter } from "next/navigation"
import { Reorder, motion, useDragControls } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  OperatorDialog,
  CancelButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { useDropZone } from "@/components/admin/file-drop"
import {
  DisplaySelect,
  Grip,
  arrowDelta,
  gripClass,
  inlineFieldClass,
} from "@/components/admin/page-fields"
import { semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { skippedFilesMessage, splitHtmlFiles } from "@/lib/admin/files"
import {
  countLabel,
  designWidthProblem,
  designWidthValue,
  externalUrlMessage,
  fileSize,
  findExternalUrls,
  nameFromFilename,
} from "@/lib/admin/format"
import { moveBy } from "@/lib/admin/reorder"
import { DEFAULT_DESIGN_WIDTH, type DisplayMode } from "@/lib/api-types"
import { useIcons } from "@/lib/icon-context"
import { useSize } from "@/lib/size-context"
import { spring } from "@/lib/springs"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Seiten hinzufügen": several HTML files at once, from a drop on the draft
// page or a multi-pick in "Seite hinzufügen". Each file is a row with its
// display name (from the file name), Fix/Fill and design width; the rows can
// be reordered and are uploaded one by one in that order, so they land at
// the end of the draft as listed. A failed upload stops there; the rows
// before it are kept as uploaded and the next try skips them.

export interface UploadRow {
  id: string
  file: File
  name: string
  display: DisplayMode
  width: string
  /** http(s) URLs found in the file; the upload refuses any. */
  external: string[]
  status: "ready" | "uploading" | "done"
  serverError: string | null
}

let nextRowId = 0

/** Reads picked or dropped files into rows; non-HTML files are only named. */
export async function readUploadRows(
  files: Iterable<File>
): Promise<{ rows: UploadRow[]; skipped: string[] }> {
  const { html, skipped } = splitHtmlFiles(files)
  const rows = await Promise.all(
    html.map(async (file) => ({
      id: `upload-${nextRowId++}`,
      file,
      name: nameFromFilename(file.name),
      display: "fixed" as const,
      width: String(DEFAULT_DESIGN_WIDTH),
      external: findExternalUrls(await file.text()),
      status: "ready" as const,
      serverError: null,
    }))
  )
  return { rows, skipped }
}

/** What keeps the row from uploading; a server error only shows, a retry may pass. */
function rowProblem(row: UploadRow): string | null {
  if (row.external.length) return externalUrlMessage(row.external)
  if (row.name.trim() === "") return "Bitte einen Anzeigenamen eingeben."
  return designWidthProblem(row.width, row.display)
}

export function BatchUploadDialog({
  open,
  onOpenChange,
  projectSlug,
  draftSlug,
  initialRows,
  initialSkipped,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectSlug: string
  draftSlug: string
  initialRows: UploadRow[]
  initialSkipped: string[]
}) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(initialRows)
  const [skipped, setSkipped] = useState(initialSkipped)
  const [pending, setPending] = useState(false)
  const [announce, setAnnounce] = useState("")

  const waiting = rows.filter((r) => r.status !== "done")
  const canSubmit =
    waiting.length > 0 && waiting.every((r) => !rowProblem(r)) && !pending

  const update = (id: string, patch: Partial<UploadRow>) =>
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const add = async (files: File[]) => {
    const read = await readUploadRows(files)
    setRows((all) => [...all, ...read.rows])
    setSkipped(read.skipped)
  }
  const drop = useDropZone((files) => void add(files), !pending)

  const reorder = (ids: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]))
    setRows(ids.map((id) => byId.get(id)).filter((r) => r !== undefined))
  }

  const move = (row: UploadRow, delta: number) => {
    const ids = rows.map((r) => r.id)
    const next = moveBy(ids, row.id, delta)
    reorder(next)
    setAnnounce(
      `„${row.name}“ ist jetzt an Position ${next.indexOf(row.id) + 1} von ${next.length}.`
    )
  }

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    let failed = false
    for (const row of rows) {
      if (row.status === "done") continue
      update(row.id, { status: "uploading" })
      const res = await operatorApi.uploadPage(projectSlug, draftSlug, {
        file: row.file,
        name: row.name.trim(),
        display: row.display,
        designWidth: designWidthValue(row.width),
      })
      if (!res.ok) {
        update(row.id, { status: "ready", serverError: res.error })
        failed = true
        break
      }
      update(row.id, { status: "done" })
    }
    setPending(false)
    router.refresh()
    if (!failed) onOpenChange(false)
  }

  const skippedMessage = skippedFilesMessage(skipped)

  return (
    <OperatorDialog
      list
      open={open}
      onOpenChange={onOpenChange}
      title="Seiten hinzufügen"
      description="Die Seiten kommen in dieser Reihenfolge ans Ende des Drafts. Styles und Bilder müssen eingebettet sein."
      onSubmit={submit}
      actions={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            loading={pending}
          >
            {waiting.length > 0
              ? `${countLabel(waiting.length, "Seite", "Seiten")} hochladen`
              : "Seiten hochladen"}
          </Button>
        </>
      }
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".html,.htm,text/html"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
      <div {...drop.props} className="flex flex-col gap-2">
        {rows.length > 0 && (
          <motion.div
            layoutScroll
            className="-m-1 max-h-[min(56vh,520px)] overflow-y-auto p-1"
          >
            <Reorder.Group
              axis="y"
              values={rows.map((r) => r.id)}
              onReorder={reorder}
              className="flex flex-col gap-2"
              aria-label="Neue Seiten in Reihenfolge"
            >
              {rows.map((row, i) => (
                <UploadRowItem
                  key={row.id}
                  row={row}
                  position={i}
                  total={rows.length}
                  locked={pending}
                  onChange={(patch) =>
                    update(row.id, { ...patch, serverError: null })
                  }
                  onMove={(delta) => move(row, delta)}
                  onRemove={() =>
                    setRows((all) => all.filter((r) => r.id !== row.id))
                  }
                />
              ))}
            </Reorder.Group>
          </motion.div>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
          className={cn(
            typeClass("body", "compact"),
            "flex items-center justify-center rounded-[10px] border border-dashed text-muted-foreground transition-colors duration-80 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
            rows.length > 0 ? "h-12" : "h-24",
            drop.over ? "border-ring bg-hover text-foreground" : "border-border"
          )}
          style={semibold}
        >
          {rows.length > 0
            ? "Weitere HTML-Dateien wählen oder hierher ziehen"
            : "HTML-Dateien wählen oder hierher ziehen"}
        </button>
        {skippedMessage && <ErrorText>{skippedMessage}</ErrorText>}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </OperatorDialog>
  )
}

function UploadRowItem({
  row,
  position,
  total,
  locked,
  onChange,
  onMove,
  onRemove,
}: {
  row: UploadRow
  position: number
  total: number
  /** An upload is running: nothing in the list changes until it ends. */
  locked: boolean
  onChange: (patch: Partial<UploadRow>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const icons = useIcons()
  const XIcon = icons.x
  const { field } = useSize()
  const controls = useDragControls()
  const [dragging, setDragging] = useState(false)

  const done = row.status === "done"
  const disabled = locked || done
  const problem = done ? null : (row.serverError ?? rowProblem(row))
  const label = row.name.trim() || row.file.name

  return (
    <Reorder.Item
      value={row.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      transition={spring.moderate}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl bg-card px-3 py-2.5",
        problem
          ? "shadow-[0_0_0_1px_var(--destructive)]"
          : "shadow-[0_0_0_1px_var(--border)]",
        dragging && "z-10 shadow-surface-5"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={`„${label}“ verschieben, Position ${position + 1} von ${total}. Pfeiltasten hoch und runter.`}
          onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
            e.preventDefault()
            controls.start(e)
          }}
          onKeyDown={(e) => {
            const delta = arrowDelta(e)
            if (!delta) return
            e.preventDefault()
            onMove(delta)
          }}
          className={cn(gripClass(dragging), "ml-0")}
        >
          <Grip />
        </button>
        <input
          type="text"
          aria-label={`Anzeigename für ${row.file.name}`}
          value={row.name}
          maxLength={120}
          disabled={disabled}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(field, inlineFieldClass, "min-w-0 grow")}
        />
        <DisplaySelect
          value={row.display}
          onChange={(display) => onChange({ display })}
          label={`Darstellung von „${label}“`}
          disabled={disabled}
        />
        <span className="flex w-24 shrink-0 items-center gap-1">
          {row.display === "fixed" && (
            <>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Designbreite von „${label}“ in px`}
                value={row.width}
                disabled={disabled}
                onChange={(e) => onChange({ width: e.target.value })}
                className={cn(
                  field,
                  inlineFieldClass,
                  "w-16 text-right tabular-nums"
                )}
              />
              <span
                aria-hidden
                className={cn(
                  typeClass("body", "compact"),
                  "text-muted-foreground"
                )}
              >
                px
              </span>
            </>
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-compact"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`„${label}“ entfernen`}
          className="shrink-0"
        >
          <XIcon />
        </Button>
      </div>
      <p
        role={problem ? "alert" : undefined}
        className={cn(
          typeClass("caption", "compact"),
          "pl-7",
          problem ? "text-destructive" : "truncate text-muted-foreground"
        )}
      >
        {problem ??
          `${row.file.name} · ${fileSize(row.file.size)}${
            row.status === "uploading"
              ? " · lädt …"
              : done
                ? " · hochgeladen"
                : ""
          }`}
      </p>
    </Reorder.Item>
  )
}
