"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import {
  OperatorDialog,
  CancelButton,
} from "@/components/admin/operator-dialog"
import { CredentialsDialog } from "@/components/admin/credentials-dialog"
import { LetterboxSwatches } from "@/components/admin/letterbox-picker"
import { useOrigin } from "@/components/admin/use-origin"
import { operatorApi } from "@/lib/admin/api"
import { slugProblem } from "@/lib/admin/slug"
import { displayUrl, draftUrl, normalizeHex } from "@/lib/admin/format"
import { DEFAULT_LETTERBOX } from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// Artboards "Neuer Draft" → "Draft angelegt". From the sidebar (which stays
// mounted) the draft page opens behind the credentials dialog; the project
// page's button stays put, since navigating would unmount the dialog. The password stays readable on the
// draft page later (ADR 0002 amendment), so this dialog is a convenience,
// not the only chance to copy it.

/** The "Neuer Draft" button of the project page. */
export function NewDraftButton({
  projectSlug,
  takenSlugs,
}: {
  projectSlug: string
  takenSlugs: string[]
}) {
  const [opening, setOpening] = useState({ key: 0, open: false })
  return (
    <>
      <Button
        variant="primary"
        onClick={() => setOpening((o) => ({ key: o.key + 1, open: true }))}
      >
        Draft anlegen
      </Button>
      <NewDraftDialog
        key={opening.key}
        open={opening.open}
        onOpenChange={(open) => setOpening((o) => ({ ...o, open }))}
        projectSlug={projectSlug}
        takenSlugs={takenSlugs}
        openAfterCreate={false}
      />
    </>
  )
}

/** Controlled; mount it fresh per opening (key) so the fields start empty. */
export function NewDraftDialog({
  open,
  onOpenChange,
  projectSlug,
  takenSlugs,
  openAfterCreate = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectSlug: string
  takenSlugs: string[]
  /** Navigate to the new draft. Only where this component outlives the route. */
  openAfterCreate?: boolean
}) {
  const router = useRouter()
  const origin = useOrigin()
  const [slug, setSlug] = useState("")
  const [letterbox, setLetterbox] = useState(DEFAULT_LETTERBOX)
  const [letterboxText, setLetterboxText] = useState(DEFAULT_LETTERBOX)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<{
    slug: string
    password: string
  } | null>(null)
  const [credsOpen, setCredsOpen] = useState(false)

  const problem = serverError ?? slugProblem(slug, "draft", takenSlugs)
  const letterboxError = normalizeHex(letterboxText)
    ? null
    : "Bitte eine Farbe als #RRGGBB eingeben."
  const canSubmit = slug !== "" && !problem && !letterboxError && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.createDraft(projectSlug, slug, letterbox)
    setPending(false)
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    onOpenChange(false)
    setCreated({ slug: res.data.draft.slug, password: res.data.password })
    setCredsOpen(true)
    if (openAfterCreate)
      router.push(`/admin/${projectSlug}/${res.data.draft.slug}`)
    router.refresh()
  }

  return (
    <>
      <OperatorDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Neuer Draft"
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
              Draft anlegen
            </Button>
          </>
        }
      >
        <InputGroup className="w-full">
          <div className="flex flex-col gap-1">
            <InputField
              index={0}
              label="Slug"
              placeholder="v1"
              value={slug}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(v) => {
                setSlug(v.trim())
                setServerError(null)
              }}
              error={problem ?? undefined}
            />
            {!problem && (
              <p
                className={cn(
                  typeClass("caption", "compact"),
                  "pl-2 wrap-anywhere text-muted-foreground"
                )}
              >
                {slug
                  ? `Frei: ${displayUrl(draftUrl(origin, projectSlug, slug))}`
                  : `${displayUrl(origin)}/${projectSlug}/…`}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <InputField
              index={1}
              label="Letterbox"
              value={letterboxText}
              placeholder={DEFAULT_LETTERBOX}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(v) => {
                setLetterboxText(v)
                const hex = normalizeHex(v)
                if (hex) setLetterbox(hex)
              }}
              error={letterboxError ?? undefined}
            />
            <LetterboxSwatches
              value={letterbox}
              onChange={(hex) => {
                setLetterbox(hex)
                setLetterboxText(hex)
              }}
            />
          </div>
        </InputGroup>
      </OperatorDialog>
      {created && (
        <CredentialsDialog
          open={credsOpen}
          onOpenChange={setCredsOpen}
          title={`${created.slug} ist angelegt`}
          description="Schick beides an alle, die den Draft ansehen sollen."
          url={draftUrl(origin, projectSlug, created.slug)}
          password={created.password}
        />
      )}
    </>
  )
}
