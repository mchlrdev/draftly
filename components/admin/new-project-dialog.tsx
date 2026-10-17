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
// until typed by hand), reserved/duplicate slugs answered inline.
export function NewProjectButton({ takenSlugs }: { takenSlugs: string[] }) {
  const router = useRouter()
  const origin = useOrigin()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const problem = serverError ?? slugProblem(slug, "project", takenSlugs)
  const canSubmit = slug !== "" && !problem && !pending

  const reset = () => {
    setTitle("")
    setSlug("")
    setSlugTouched(false)
    setServerError(null)
    setPending(false)
  }

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.createProject(slug, title.trim() || undefined)
    if (!res.ok) {
      setPending(false)
      setServerError(res.error)
      return
    }
    setOpen(false)
    router.push(`/admin/${res.data.slug}`)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        Neues Projekt
      </Button>
      <OperatorDialog
        open={open}
        onOpenChange={setOpen}
        title="Neues Projekt"
        description="Der Slug steht vorne in jeder Draft-URL. Kleinbuchstaben, Zahlen, Bindestriche."
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
          <InputField
            index={0}
            label="Titel"
            placeholder="Tanjas Wellness-Oase"
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
              placeholder="tanjas-oase"
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
    </>
  )
}
