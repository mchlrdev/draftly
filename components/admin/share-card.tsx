"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  OperatorDialog,
  CancelButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { CopyButton } from "@/components/admin/copy-button"
import { CredentialsDialog } from "@/components/admin/credentials-dialog"
import { EyeIcon, EyeOffIcon } from "@/components/admin/icons"
import { LetterboxPicker } from "@/components/admin/letterbox-picker"
import { cardClass, semibold } from "@/components/admin/text"
import { useOrigin } from "@/components/admin/use-origin"
import { operatorApi } from "@/lib/admin/api"
import { displayUrl, draftUrl } from "@/lib/admin/format"
import type { Draft } from "@/lib/api-types"
import { spring } from "@/lib/springs"
import { useSize } from "@/lib/size-context"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// The "Share" card of artboard "Draft · Aktionen": link (copy), password
// (masked; reveal, copy without revealing, rotate → "Passwort rotieren" →
// "Passwort rotiert"), letterbox (change). The password is read from the API
// on mount (ADR 0002 amendment); drafts from before that have none stored.
export function ShareCard({ draft }: { draft: Draft }) {
  const router = useRouter()
  const origin = useOrigin()
  const url = draftUrl(origin, draft.projectSlug, draft.slug)

  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateError, setRotateError] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const [credsOpen, setCredsOpen] = useState(false)

  // undefined while loading, null when not stored, an Error when unreadable.
  const [stored, setStored] = useState<string | null | undefined | Error>(
    undefined
  )
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    let alive = true
    void operatorApi.readPassword(draft.projectSlug, draft.slug).then((res) => {
      if (!alive) return
      setStored(res.ok ? res.data.password : new Error(res.error))
    })
    return () => {
      alive = false
    }
  }, [draft.projectSlug, draft.slug])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [letterbox, setLetterbox] = useState(draft.letterbox)
  const saved = useRef(draft.letterbox)
  const [letterboxError, setLetterboxError] = useState<string | null>(null)

  const rotate = async () => {
    setRotating(true)
    const res = await operatorApi.rotatePassword(draft.projectSlug, draft.slug)
    setRotating(false)
    if (!res.ok) {
      setRotateError(res.error)
      return
    }
    setRotateOpen(false)
    setPassword(res.data.password)
    setStored(res.data.password)
    setCredsOpen(true)
  }

  const saveLetterbox = async () => {
    if (letterbox === saved.current) return
    const res = await operatorApi.updateDraft(draft.projectSlug, draft.slug, {
      letterbox,
    })
    if (!res.ok) {
      setLetterboxError(res.error)
      setLetterbox(saved.current)
      return
    }
    saved.current = res.data.letterbox
    setLetterboxError(null)
    router.refresh()
  }

  return (
    <section
      aria-label="Teilen"
      className={cn(cardClass, "flex flex-col gap-2 px-5 py-3")}
    >
      <Row
        label="Link"
        action={
          <CopyButton
            variant="ghost"
            className="text-foreground"
            text={url}
            aria-label="Link kopieren"
          />
        }
      >
        <span className="truncate">{displayUrl(url)}</span>
      </Row>
      <Row
        label="Passwort"
        action={
          <>
            {typeof stored === "string" && (
              <CopyButton
                variant="ghost"
                className="text-foreground"
                text={stored}
                aria-label="Passwort kopieren"
              />
            )}
            <Button
              variant="ghost"
              className="text-foreground"
              style={semibold}
              onClick={() => {
                setRotateError(null)
                setRotateOpen(true)
              }}
            >
              Rotieren
            </Button>
          </>
        }
      >
        {stored === undefined ? (
          <span className="text-muted-foreground">…</span>
        ) : stored instanceof Error ? (
          <span className="text-destructive">{stored.message}</span>
        ) : stored === null ? (
          <span className="text-muted-foreground">
            Nicht gespeichert · einmal rotieren
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1">
            <span
              className="truncate tabular-nums"
              data-testid="draft-password"
            >
              {revealed ? stored : maskPassword(stored)}
            </span>
            <RevealToggle
              revealed={revealed}
              onToggle={() => setRevealed((r) => !r)}
            />
          </span>
        )}
      </Row>
      <Row
        label="Letterbox"
        action={
          <Button
            variant="ghost"
            className="text-foreground"
            style={semibold}
            onClick={() => setPickerOpen(true)}
          >
            Ändern
          </Button>
        }
      >
        <span className="flex flex-col gap-1">
          <LetterboxPicker
            value={letterbox}
            onChange={setLetterbox}
            open={pickerOpen}
            onOpenChange={(next) => {
              setPickerOpen(next)
              if (!next) void saveLetterbox()
            }}
          />
          {letterboxError && <ErrorText>{letterboxError}</ErrorText>}
        </span>
      </Row>

      <OperatorDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Passwort rotieren?"
        description={`Draftly erzeugt ein neues Passwort für ${draft.slug}. Das alte funktioniert danach nicht mehr. Link, Seiten und Kommentare bleiben.`}
        onSubmit={rotate}
        actions={
          <>
            <CancelButton onClick={() => setRotateOpen(false)} />
            <Button type="submit" variant="primary" loading={rotating}>
              Neues Passwort erzeugen
            </Button>
          </>
        }
      >
        {rotateError && <ErrorText>{rotateError}</ErrorText>}
      </OperatorDialog>

      {password && (
        <CredentialsDialog
          open={credsOpen}
          onOpenChange={setCredsOpen}
          title={`Neues Passwort für ${draft.slug}`}
          description={`Das alte Passwort funktioniert ab sofort nicht mehr. Schick das neue an alle, die ${draft.slug} ansehen sollen.`}
          url={url}
          password={password}
        />
      )}
    </section>
  )
}

function Row({
  label,
  children,
  action,
}: {
  label: string
  children: ReactNode
  action: ReactNode
}) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span
        className={cn(
          typeClass("body", "compact"),
          "w-23 shrink-0 text-muted-foreground"
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          typeClass("subtitle", "compact"),
          "flex min-w-0 grow items-center text-foreground"
        )}
      >
        {children}
      </div>
      <div className="flex w-44 shrink-0 justify-end gap-1">{action}</div>
    </div>
  )
}

/** "k7mq-2xpr-9tnd" → "••••-••••-••••" (same shape, nothing readable). */
function maskPassword(password: string): string {
  return password.replace(/[^-]/g, "•")
}

// Eye / eye-off in one icon cell, crossfading like the system's icon swaps:
// the arriving glyph on the fast tier, the leaving one on its exit tween.
const ICON_SHOWN = { opacity: 1, filter: "blur(0px)", scale: 1 }
const ICON_HIDDEN = { opacity: 0, filter: "blur(4px)", scale: 0.6 }
const iconEnter = {
  type: "tween" as const,
  duration: spring.fast.duration,
  ease: "easeOut" as const,
}
const iconLeave = {
  type: "tween" as const,
  ...spring.fast.exit,
  ease: "easeIn" as const,
}

function RevealToggle({
  revealed,
  onToggle,
}: {
  revealed: boolean
  onToggle: () => void
}) {
  const { icon } = useSize()
  return (
    <Button
      variant="ghost"
      size="icon-compact"
      aria-label={revealed ? "Passwort verbergen" : "Passwort zeigen"}
      aria-pressed={revealed}
      onClick={onToggle}
      className="shrink-0"
    >
      <span className="inline-grid" style={{ width: icon, height: icon }}>
        <motion.span
          className="col-start-1 row-start-1 flex"
          initial={false}
          animate={revealed ? ICON_HIDDEN : ICON_SHOWN}
          transition={revealed ? iconLeave : iconEnter}
        >
          <EyeIcon size={icon} strokeWidth={1.5} />
        </motion.span>
        <motion.span
          className="col-start-1 row-start-1 flex"
          initial={false}
          animate={revealed ? ICON_SHOWN : ICON_HIDDEN}
          transition={revealed ? iconEnter : iconLeave}
        >
          <EyeOffIcon size={icon} strokeWidth={1.5} />
        </motion.span>
      </span>
    </Button>
  )
}
