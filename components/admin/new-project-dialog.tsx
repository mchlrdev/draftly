"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import {
  OperatorDialog,
  CancelButton,
} from "@/components/admin/operator-dialog"
import { useOrigin } from "@/components/admin/use-origin"
import { operatorApi } from "@/lib/admin/api"
import { slugProblem, slugify } from "@/lib/admin/slug"
import { displayUrl } from "@/lib/admin/format"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// Artboard "Neues Projekt": optional title, slug (suggested from the title
// until typed by hand), reserved/duplicate slugs answered inline. Opened from
// the sidebar; mount it fresh per opening (key) so the fields start empty.
export function NewProjectDialog({
  open,
  onOpenChange,
  takenSlugs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  takenSlugs: string[]
}) {
  const router = useRouter()
  const origin = useOrigin()
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const problem = serverError ?? slugProblem(slug, "project", takenSlugs)
  const canSubmit = slug !== "" && !problem && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.createProject(slug, title.trim() || undefined)
    if (!res.ok) {
      setPending(false)
      setServerError(res.error)
      return
    }
    onOpenChange(false)
    router.push(`/admin/${res.data.slug}`)
    router.refresh()
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Neues Projekt"
      description="Der Slug steht in jeder Draft-URL. Nur Kleinbuchstaben, Zahlen und Bindestriche."
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
            Projekt anlegen
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
            if (!slugTouched) setSlug(slugify(v))
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
              setSlugTouched(true)
              setServerError(null)
            }}
            error={problem ?? undefined}
          />
          {!problem && (
            <p
              className={cn(
                typeClass("caption", "compact"),
                "truncate pl-2 text-muted-foreground"
              )}
            >
              {displayUrl(origin)}/{slug || "…"}
            </p>
          )}
        </div>
      </InputGroup>
    </OperatorDialog>
  )
}
