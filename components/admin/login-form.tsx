"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { InputField, InputGroup } from "@/components/ui/input-group"
import { BrandLabel } from "@/components/admin/brand-label"
import { cardClass, semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// Artboards "Anmelden" and "Anmelden · Fehler".
export function LoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || pending) return
    setPending(true)
    const res = await operatorApi.login(password)
    if (res.ok) {
      router.refresh()
      return
    }
    setPending(false)
    setError(res.status === 401 ? "Falsches Passwort." : res.error)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-1 px-4">
      <div className="flex w-105 max-w-full flex-col items-center pb-5">
        <BrandLabel />
      </div>
      <form
        onSubmit={submit}
        className={cn(
          cardClass,
          "flex w-105 max-w-full flex-col gap-3 px-9 pt-9 pb-8"
        )}
      >
        <div className="flex flex-col gap-2 pb-5">
          <h1
            className={cn(typeClass("display", "compact"), "text-foreground")}
            style={semibold}
          >
            Draftly
          </h1>
          <p
            className={cn(
              typeClass("subtitle", "compact"),
              "text-muted-foreground"
            )}
          >
            Operator-Zugang. Ein Passwort, eine Session.
          </p>
        </div>
        <InputGroup className="w-full">
          <InputField
            index={0}
            label="Passwort"
            labelHidden
            placeholder="Passwort"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(v) => {
              setPassword(v)
              setError(undefined)
            }}
            error={error}
          />
        </InputGroup>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={pending}
          disabled={!password}
        >
          Anmelden
        </Button>
        <p
          className={cn(
            typeClass("caption", "compact"),
            "pt-2 text-muted-foreground"
          )}
        >
          Nur du. Das Cookie hält die Sitzung.
        </p>
      </form>
    </main>
  )
}
