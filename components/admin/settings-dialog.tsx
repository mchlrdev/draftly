"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import {
  OperatorDialog,
  CancelButton,
} from "@/components/admin/operator-dialog"
import { operatorApi } from "@/lib/admin/api"

// "Einstellungen" from the sidebar footer: the operator's own name, shown in
// the footer and on the comments they write in a draft. Mount it fresh per
// opening (key) so the field starts from the saved name.
export function OperatorSettingsDialog({
  open,
  onOpenChange,
  operatorName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  operatorName: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState(operatorName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const tooLong = name.trim().length > 60
  const canSubmit = !pending && !tooLong

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    const res = await operatorApi.updateSettings({ operatorName: name.trim() })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Einstellungen"
      description="Dein Name steht in der Seitenleiste und an deinen Kommentaren."
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
          label="Dein Name"
          placeholder="Vorname"
          value={name}
          autoFocus
          autoComplete="given-name"
          onChange={(v) => {
            setName(v)
            setError(null)
          }}
          error={error ?? (tooLong ? "Höchstens 60 Zeichen." : undefined)}
        />
      </InputGroup>
    </OperatorDialog>
  )
}
