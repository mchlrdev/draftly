"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  OperatorDialog,
  CancelButton,
  DangerButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { DangerZone, semibold } from "@/components/admin/text"
import { useOrigin } from "@/components/admin/use-origin"
import { operatorApi } from "@/lib/admin/api"
import { deleteDraftText, draftUrl } from "@/lib/admin/format"
import type { DraftSummary } from "@/lib/api-types"

// Artboard "Draft löschen" as the danger zone at the foot of the draft page.
export function DeleteDraft({ draft }: { draft: DraftSummary }) {
  const [opening, setOpening] = useState({ key: 0, open: false })
  return (
    <>
      <DangerZone text="Löscht auch alle Seiten und Kommentare.">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          style={semibold}
          onClick={() => setOpening((o) => ({ key: o.key + 1, open: true }))}
        >
          Draft löschen
        </Button>
      </DangerZone>
      <DeleteDraftDialog
        key={opening.key}
        open={opening.open}
        onOpenChange={(open) => setOpening((o) => ({ ...o, open }))}
        draft={draft}
        leaveTo={`/admin/${draft.projectSlug}`}
      />
    </>
  )
}

/** Controlled; mount it fresh per opening (key). */
export function DeleteDraftDialog({
  open,
  onOpenChange,
  draft,
  leaveTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: DraftSummary
  /** Where to go afterwards when the current page was this draft. */
  leaveTo?: string
}) {
  const router = useRouter()
  const origin = useOrigin()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setPending(true)
    const res = await operatorApi.deleteDraft(draft.projectSlug, draft.slug)
    if (!res.ok) {
      setPending(false)
      setError(res.error)
      return
    }
    onOpenChange(false)
    if (leaveTo) router.push(leaveTo)
    router.refresh()
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${draft.slug} löschen?`}
      description={deleteDraftText(
        draftUrl(origin, draft.projectSlug, draft.slug),
        draft
      )}
      onSubmit={submit}
      actions={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <DangerButton type="submit" loading={pending}>
            Draft löschen
          </DangerButton>
        </>
      }
    >
      {error && <ErrorText>{error}</ErrorText>}
    </OperatorDialog>
  )
}
