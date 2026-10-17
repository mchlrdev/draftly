"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import {
  OperatorDialog,
  CancelButton,
} from "@/components/admin/operator-dialog"
import { LetterboxSwatches } from "@/components/admin/letterbox-picker"
import { useOrigin } from "@/components/admin/use-origin"
import { operatorApi } from "@/lib/admin/api"
import { slugProblem } from "@/lib/admin/slug"
import { displayUrl, draftUrl, normalizeHex } from "@/lib/admin/format"
import type { DraftSummary, Project } from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Bearbeiten" from a sidebar row's menu. Both dialogs send only what
// changed; when the open page belongs to the renamed project or draft, the
// URL follows with router.replace. Mount each fresh per opening (key).

type RouteParams = { project?: string; draft?: string }

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        typeClass("caption", "compact"),
        "pl-2 wrap-anywhere text-muted-foreground"
      )}
    >
      {children}
    </p>
  )
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  takenSlugs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Pick<Project, "slug" | "title">
  /** Every project slug, this one included. */
  takenSlugs: string[]
}) {
  const router = useRouter()
  const params = useParams<RouteParams>()
  const origin = useOrigin()
  const [title, setTitle] = useState(project.title)
  const [slug, setSlug] = useState(project.slug)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const problem =
    serverError ??
    (slug === ""
      ? "Der Slug darf nicht leer sein."
      : slugProblem(
          slug,
          "project",
          takenSlugs.filter((s) => s !== project.slug)
        ))
  const changed = title.trim() !== project.title || slug !== project.slug
  const canSubmit = changed && !problem && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const patch: { title?: string; slug?: string } = {}
    if (title.trim() !== project.title) patch.title = title.trim()
    if (slug !== project.slug) patch.slug = slug
    const res = await operatorApi.updateProject(project.slug, patch)
    if (!res.ok) {
      setPending(false)
      setServerError(res.error)
      return
    }
    onOpenChange(false)
    if (patch.slug && params.project === project.slug) {
      const rest = params.draft ? `/${params.draft}` : ""
      router.replace(`/admin/${res.data.slug}${rest}`)
    }
    router.refresh()
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Projekt bearbeiten"
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
            Speichern
          </Button>
        </>
      }
    >
      <InputGroup className="w-full">
        <InputField
          index={0}
          label="Titel"
          placeholder="Projektname"
          value={title}
          autoFocus
          onChange={(v) => {
            setTitle(v)
            setServerError(null)
          }}
        />
        <div className="flex flex-col gap-1">
          <InputField
            index={1}
            label="Slug"
            placeholder="project-name"
            value={slug}
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
            <Hint>
              {slug === project.slug
                ? `${displayUrl(origin)}/${slug}/…`
                : "Ein neuer Slug ändert die Links aller Drafts im Projekt."}
            </Hint>
          )}
        </div>
      </InputGroup>
    </OperatorDialog>
  )
}

export function EditDraftDialog({
  open,
  onOpenChange,
  draft,
  takenSlugs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Pick<DraftSummary, "slug" | "projectSlug" | "letterbox">
  /** Every draft slug in the project, this one included. */
  takenSlugs: string[]
}) {
  const router = useRouter()
  const params = useParams<RouteParams>()
  const origin = useOrigin()
  const [slug, setSlug] = useState(draft.slug)
  const [letterbox, setLetterbox] = useState(draft.letterbox)
  const [letterboxText, setLetterboxText] = useState(draft.letterbox)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const problem =
    serverError ??
    (slug === ""
      ? "Der Slug darf nicht leer sein."
      : slugProblem(
          slug,
          "draft",
          takenSlugs.filter((s) => s !== draft.slug)
        ))
  const letterboxError = normalizeHex(letterboxText)
    ? null
    : "Eine Farbe als #RRGGBB."
  const changed = slug !== draft.slug || letterbox !== draft.letterbox
  const canSubmit = changed && !problem && !letterboxError && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const patch: { slug?: string; letterbox?: string } = {}
    if (slug !== draft.slug) patch.slug = slug
    if (letterbox !== draft.letterbox) patch.letterbox = letterbox
    const res = await operatorApi.updateDraft(
      draft.projectSlug,
      draft.slug,
      patch
    )
    if (!res.ok) {
      setPending(false)
      setServerError(res.error)
      return
    }
    onOpenChange(false)
    if (
      patch.slug &&
      params.project === draft.projectSlug &&
      params.draft === draft.slug
    )
      router.replace(`/admin/${draft.projectSlug}/${res.data.slug}`)
    router.refresh()
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Draft bearbeiten"
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
            Speichern
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
            <Hint>
              {slug === draft.slug
                ? displayUrl(draftUrl(origin, draft.projectSlug, slug))
                : `Der Link wird ${displayUrl(draftUrl(origin, draft.projectSlug, slug))}, der alte zeigt dann 404.`}
            </Hint>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <InputField
            index={1}
            label="Letterbox"
            value={letterboxText}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(v) => {
              setLetterboxText(v)
              const hex = normalizeHex(v)
              if (hex) setLetterbox(hex)
              setServerError(null)
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
  )
}
