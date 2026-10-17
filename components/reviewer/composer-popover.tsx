"use client"

import { useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { useSize } from "@/lib/size-context"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"
import { MAX_COMMENT_LENGTH } from "@/lib/api-types"
import { reviewerApi } from "@/lib/reviewer/api"
import { saveName } from "@/lib/reviewer/identity"
import type { PopoverPlacement } from "@/lib/reviewer/geometry"
import { FramedInput, FramedTextarea } from "@/components/reviewer/fields"
import { PopoverShell } from "@/components/reviewer/popover-shell"
import { useViewer } from "@/components/reviewer/viewer-context"

// Artboard "Viewer · Neuer Pin": the first comment of a new thread. The name
// comes from the password gate; the composer only says who is commenting.

export function ComposerPopover({
  placement,
  pageId,
  point,
  onDone,
  onCancel,
  onDraftChange,
}: {
  placement: PopoverPlacement
  pageId: string
  point: { x: number; y: number }
  onDone: (threadId: string) => void
  onCancel: () => void
  onDraftChange: (hasText: boolean) => void
}) {
  const { draftRef, dispatch, clientId, authorName } = useViewer()
  const size = useSize()
  const [body, setBody] = useState("")
  // Only when this browser lost its name (storage cleared after unlocking).
  const [fallbackName, setFallbackName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  const name = authorName || fallbackName.trim()
  const canSubmit =
    body.trim().length > 0 && name.length > 0 && !!clientId && !pending

  async function submit() {
    if (!canSubmit || !clientId) return
    setPending(true)
    setError(undefined)
    try {
      if (!authorName) saveName(name)
      const thread = await reviewerApi.createThread(draftRef, {
        pageId,
        x: point.x,
        y: point.y,
        body: body.trim(),
        authorName: name,
        clientId,
      })
      dispatch({ type: "event", event: { type: "thread.created", thread } })
      onDone(thread.id)
    } catch (err) {
      setPending(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    }
  }

  return (
    <PopoverShell
      placement={placement}
      label="Neuer Kommentar"
      className="gap-2.5"
    >
      {authorName ? (
        <p
          className={cn(size.type.body, "text-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          Kommentieren als {authorName}
        </p>
      ) : (
        <FramedInput
          aria-label="Dein Name"
          placeholder="Dein Name"
          value={fallbackName}
          maxLength={60}
          onChange={(e) => setFallbackName(e.target.value)}
        />
      )}
      <FramedTextarea
        autoFocus
        aria-label="Kommentar"
        placeholder="Was fällt dir hier auf?"
        className="min-h-22"
        value={body}
        maxLength={MAX_COMMENT_LENGTH}
        onChange={(e) => {
          setBody(e.target.value)
          onDraftChange(e.target.value.trim().length > 0)
        }}
        onKeyDown={onKeyDown}
        disabled={pending}
      />
      {error && (
        <p role="alert" className={cn(size.type.caption, "text-destructive")}>
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-1 pt-0.5">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={!canSubmit && !pending}
          loading={pending}
        >
          Pin setzen
        </Button>
      </div>
    </PopoverShell>
  )
}
