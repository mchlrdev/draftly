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

// Artboards "Neuer Draft" → "Draft angelegt". The generated password exists
// only in this component's state until the operator closes the second dialog.
export function NewDraftButton({
  projectSlug,
  takenSlugs,
}: {
  projectSlug: string
  takenSlugs: string[]
}) {
  const router = useRouter()
  const origin = useOrigin()
  const [open, setOpen] = useState(false)
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
    : "Eine Farbe als #RRGGBB."
  const canSubmit = slug !== "" && !problem && !letterboxError && !pending

  const start = () => {
    setCreated(null)
    setSlug("")
    setLetterbox(DEFAULT_LETTERBOX)
    setLetterboxText(DEFAULT_LETTERBOX)
    setServerError(null)
    setPending(false)
    setOpen(true)
  }

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.createDraft(projectSlug, slug, letterbox)
    setPending(false)
    if (!res.ok) {
      setServerError(res.error)
      return
    }
    setOpen(false)
    setCreated({ slug: res.data.draft.slug, password: res.data.password })
    setCredsOpen(true)
    router.refresh()
  }

  return (
    <>
      <Button variant="primary" onClick={start}>
        Neuer Draft
      </Button>
      <OperatorDialog
        open={open}
        onOpenChange={setOpen}
        title="Neuer Draft"
        description="Draftly erzeugt ein Passwort. Du siehst es einmal, direkt nach dem Anlegen."
        onSubmit={submit}
        actions={
          <>
            <CancelButton onClick={() => setOpen(false)} />
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
              loading={pending}
            >
              Anlegen
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
                  ? `Frei. ${displayUrl(draftUrl(origin, projectSlug, slug))} ist noch nicht vergeben.`
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
          description="Das Passwort siehst du nur jetzt. Danach lässt es sich nur noch rotieren."
          url={draftUrl(origin, projectSlug, created.slug)}
          password={created.password}
        />
      )}
    </>
  )
}
