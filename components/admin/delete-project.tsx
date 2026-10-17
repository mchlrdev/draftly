"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import {
  OperatorDialog,
  CancelButton,
  DangerButton,
  ErrorText,
} from "@/components/admin/operator-dialog"
import { DangerZone, semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { deleteProjectAction, deleteProjectText } from "@/lib/admin/format"

export interface DeleteProjectTarget {
  slug: string
  title: string
  draftCount: number
}

// Artboard "Projekt löschen" as the danger zone at the foot of the project page.
export function DeleteProject(target: DeleteProjectTarget) {
  const [opening, setOpening] = useState({ key: 0, open: false })
  return (
    <>
      <DangerZone text="Ein Projekt löschen nimmt alle Drafts und ihre Links mit.">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          style={semibold}
          onClick={() => setOpening((o) => ({ key: o.key + 1, open: true }))}
        >
          Projekt löschen
        </Button>
      </DangerZone>
      <DeleteProjectDialog
        key={opening.key}
        open={opening.open}
        onOpenChange={(open) => setOpening((o) => ({ ...o, open }))}
        target={target}
        leaveTo="/admin"
      />
    </>
  )
}

// An empty project goes after a plain confirm. One with drafts (known from
// the props, or learned from a 409) asks for the slug to be typed, then
// deletes with ?force=1. Mount it fresh per opening (key).
export function DeleteProjectDialog({
  open,
  onOpenChange,
  target: { slug, title, draftCount },
  leaveTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: DeleteProjectTarget
  /** Where to go afterwards when the current page belonged to the project. */
  leaveTo?: string
}) {
  const router = useRouter()
  const [count, setCount] = useState(draftCount)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const needsForce = count > 0
  const canSubmit = !pending && (!needsForce || typed === slug)

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.deleteProject(slug, needsForce)
    if (res.ok) {
      onOpenChange(false)
      if (leaveTo) router.push(leaveTo)
      router.refresh()
      return
    }
    setPending(false)
    if (res.status === 409) {
      // Drafts appeared since the page rendered: ask for the typed confirm.
      setCount((c) => Math.max(c, 1))
      router.refresh()
      return
    }
    setError(res.error)
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Projekt löschen?"
      description={
        needsForce
          ? deleteProjectText(title, count)
          : `„${title}“ hat keine Drafts. Das Projekt verschwindet aus der Liste.`
      }
      onSubmit={submit}
      actions={
        <>
          <CancelButton onClick={() => onOpenChange(false)} />
          <DangerButton type="submit" disabled={!canSubmit} loading={pending}>
            {needsForce ? deleteProjectAction(count) : "Projekt löschen"}
          </DangerButton>
        </>
      }
    >
      {needsForce && (
        <InputGroup className="w-full">
          <InputField
            index={0}
            label={`Zum Bestätigen den Slug tippen: ${slug}`}
            placeholder={slug}
            value={typed}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(v) => {
              setTyped(v.trim())
              setError(null)
            }}
            error={error ?? undefined}
          />
        </InputGroup>
      )}
      {!needsForce && error && <ErrorText>{error}</ErrorText>}
    </OperatorDialog>
  )
}
