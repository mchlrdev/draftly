"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import { Tabs, TabItem, TabsList } from "@/components/ui/tabs"
import {
  OperatorDialog,
  CancelButton,
  ErrorText,
  FieldBlock,
} from "@/components/admin/operator-dialog"
import { semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import {
  designWidthProblem,
  externalUrlMessage,
  fileSize,
  findExternalUrls,
  nameFromFilename,
} from "@/lib/admin/format"
import {
  DEFAULT_DESIGN_WIDTH,
  type DisplayMode,
  type Page,
} from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// Artboards "HTML laden" (upload) and "Seite ersetzen" (replace). The file
// is read in the browser first, so a page with http(s) URLs is refused before
// the upload; the server's own 422 lands in the same place.

interface PickedFile {
  file: File
  external: string[]
}

export function PageFormDialog({
  open,
  onOpenChange,
  projectSlug,
  draftSlug,
  page,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectSlug: string
  draftSlug: string
  /** Set for "Seite ersetzen". */
  page?: Page
}) {
  const router = useRouter()
  const inputId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [name, setName] = useState(page?.name ?? "")
  const [nameTouched, setNameTouched] = useState(Boolean(page))
  const [display, setDisplay] = useState<DisplayMode>(page?.display ?? "fixed")
  const [width, setWidth] = useState(
    String(page?.designWidth ?? DEFAULT_DESIGN_WIDTH)
  )
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const replacing = Boolean(page)
  const fileError = picked?.external.length
    ? externalUrlMessage(picked.external)
    : null
  const widthError = designWidthProblem(width, display)
  const fileProblem = serverError ?? fileError
  const canSubmit =
    !!picked && !fileError && !widthError && name.trim() !== "" && !pending

  const pick = async (file: File | undefined) => {
    setServerError(null)
    if (!file) return
    const text = await file.text()
    setPicked({ file, external: findExternalUrls(text) })
    if (!nameTouched) setName(nameFromFilename(file.name))
  }

  const submit = async () => {
    if (!canSubmit || !picked) return
    setPending(true)
    const form = {
      file: picked.file,
      name: name.trim(),
      display,
      designWidth:
        display === "fixed"
          ? Number(width)
          : Number(width) || DEFAULT_DESIGN_WIDTH,
    }
    const res = page
      ? await operatorApi.replacePage(projectSlug, draftSlug, page.id, form)
      : await operatorApi.uploadPage(projectSlug, draftSlug, form)
    setPending(false)
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <OperatorDialog
      wide
      open={open}
      onOpenChange={onOpenChange}
      title={page ? `„${page.name}“ ersetzen` : "Seite hinzufügen"}
      description={
        page
          ? "Die neue Datei ersetzt die alte. Die Seite behält ihre Kommentare, die Pins bleiben an ihren Design-Koordinaten."
          : "Eine HTML-Datei mit eingebetteten Styles und Bildern. Externe Links (http, https) werden abgelehnt."
      }
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
            {replacing ? "Ersetzen" : "Hochladen"}
          </Button>
        </>
      }
    >
      <input
        ref={fileInput}
        id={inputId}
        type="file"
        accept=".html,.htm,text/html"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <div className="flex flex-col gap-2">
        {picked ? (
          <div
            className={cn(
              "flex items-center gap-3 rounded-[10px] p-3.5",
              fileProblem
                ? "bg-destructive-light shadow-[inset_0_0_0_1px_var(--destructive)]"
                : "bg-muted/50 shadow-[inset_0_0_0_1px_var(--border)]"
            )}
          >
            <span
              aria-hidden
              className={cn(
                typeClass("micro", "compact"),
                "flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-[0_0_0_1px_var(--border)]"
              )}
              style={semibold}
            >
              HTML
            </span>
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span
                className={cn(
                  typeClass("body", "compact"),
                  "truncate text-foreground"
                )}
                style={semibold}
              >
                {picked.file.name}
              </span>
              <span
                className={cn(
                  typeClass("caption", "compact"),
                  "text-muted-foreground"
                )}
              >
                {fileSize(picked.file.size)}
                {!fileError && " · keine externen URLs"}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              className="text-foreground"
              style={semibold}
              onClick={() => fileInput.current?.click()}
            >
              Andere Datei
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={cn(
              typeClass("body", "compact"),
              "flex h-16 items-center justify-center rounded-[10px] border border-dashed border-border text-muted-foreground transition-colors duration-80 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
            )}
            style={semibold}
          >
            HTML-Datei wählen
          </button>
        )}
        {fileProblem && <ErrorText>{fileProblem}</ErrorText>}
        {replacing && !fileProblem && (
          <p
            className={cn(
              typeClass("caption", "compact"),
              "text-muted-foreground"
            )}
          >
            Wenn sich das Layout stark verändert hat, sitzen Pins evtl. daneben.
          </p>
        )}
      </div>

      <InputGroup className="w-full">
        <InputField
          index={0}
          label="Anzeigename"
          placeholder="Start"
          value={name}
          maxLength={120}
          onChange={(v) => {
            setName(v)
            setNameTouched(true)
          }}
        />
      </InputGroup>

      <div className="flex items-start gap-3">
        <div className="grow">
          <FieldBlock label="Darstellung">
            <Tabs
              value={display}
              onValueChange={(v) => setDisplay(v as DisplayMode)}
            >
              <TabsList
                className="w-full [&>*]:flex-1"
                aria-label="Darstellung"
              >
                <TabItem value="fixed" label="Fix" />
                <TabItem value="fill" label="Fill" />
              </TabsList>
            </Tabs>
          </FieldBlock>
        </div>
        <div className="w-35 shrink-0">
          <InputGroup className="w-full">
            <InputField
              index={0}
              label="Designbreite (px)"
              inputMode="numeric"
              value={display === "fixed" ? width : ""}
              placeholder={
                display === "fixed"
                  ? String(DEFAULT_DESIGN_WIDTH)
                  : "Viewer-Breite"
              }
              disabled={display === "fill"}
              onChange={setWidth}
              error={widthError ?? undefined}
            />
          </InputGroup>
        </div>
      </div>
    </OperatorDialog>
  )
}
