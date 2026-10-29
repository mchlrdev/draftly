"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  TabsSubtle,
  TabsSubtleItem,
  TabsSubtlePanel,
} from "@/components/ui/tabs-subtle"
import { InputField, InputGroup } from "@/components/ui/input-group"
import { FieldBlock, OperatorDialog } from "@/components/admin/operator-dialog"
import { CopyButton } from "@/components/admin/copy-button"
import { useOrigin } from "@/components/admin/use-origin"
import { semibold } from "@/components/admin/text"
import { operatorApi } from "@/lib/admin/api"
import { agentSetups, tokenMeta, type AgentSetup } from "@/lib/admin/format"
import type { ApiToken } from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Agenten" from the sidebar footer (ADR 0004): API tokens for the MCP
// endpoint. A new token is shown once, together with how each agent (Claude
// Code, Cursor, any other remote-MCP client) is wired to it; afterwards the
// list only shows its name and use.

export function AgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const origin = useOrigin()
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void operatorApi.listTokens().then((res) => {
      if (!live) return
      if (res.ok) setTokens(res.data)
      else setError(res.error)
    })
    return () => {
      live = false
    }
  }, [])

  const tooLong = name.trim().length > 60
  const canCreate = !pending && !tooLong && name.trim().length > 0

  const create = async () => {
    if (!canCreate) return
    setPending(true)
    const res = await operatorApi.createToken(name.trim())
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setTokens((t) => [res.data.apiToken, ...(t ?? [])])
    setCreated(res.data.token)
    setName("")
  }

  const revoke = async (id: string) => {
    const res = await operatorApi.revokeToken(id)
    if (!res.ok && res.status !== 404) {
      setError(res.error)
      return
    }
    setTokens((t) => (t ?? []).filter((x) => x.id !== id))
  }

  if (created)
    return (
      <CreatedToken
        open={open}
        onOpenChange={onOpenChange}
        token={created}
        setups={agentSetups(origin, created)}
        onDone={() => setCreated(null)}
      />
    )

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Agenten"
      description="Ein Agent wie Claude Code wandelt Paper-Frames selbst in Seiten um und lädt sie hoch. Jedes Token ist ein eigener Schlüssel und lässt sich einzeln widerrufen."
      onSubmit={create}
      actions={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canCreate}
            loading={pending}
          >
            Token erstellen
          </Button>
        </>
      }
    >
      <InputGroup className="w-full">
        <InputField
          index={0}
          label="Name des neuen Tokens"
          placeholder="z. B. Claude Code auf dem MacBook"
          value={name}
          autoFocus
          onChange={(v) => {
            setName(v)
            setError(null)
          }}
          error={
            error ??
            (tooLong ? "Bitte höchstens 60 Zeichen eingeben." : undefined)
          }
        />
      </InputGroup>

      <FieldBlock
        label="Aktive Tokens"
        hint={
          <>
            MCP-URL <Code>{origin}/api/mcp</Code>. Nach dem Erstellen zeigt
            Draftly die Einrichtung für Claude Code, Cursor und andere Agenten.
            Für Agenten ohne MCP-Prompts gibt es den Skill auch als{" "}
            <a
              href="/api/admin/agent/skill"
              download
              className="text-foreground underline underline-offset-2"
            >
              SKILL.md
            </a>
            .
          </>
        }
      >
        {tokens === null ? (
          <p
            className={cn(
              typeClass("body", "compact"),
              "text-muted-foreground"
            )}
          >
            Lädt …
          </p>
        ) : tokens.length === 0 ? (
          <p
            className={cn(
              typeClass("body", "compact"),
              "text-muted-foreground"
            )}
          >
            Noch keine Tokens.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--border)]">
            {tokens.map((t) => (
              <TokenRow key={t.id} token={t} onRevoke={() => revoke(t.id)} />
            ))}
          </ul>
        )}
      </FieldBlock>
    </OperatorDialog>
  )
}

/** Revoking asks once more on the same button: a revoked agent stops at its next call. */
function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiToken
  onRevoke: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 pr-2 pl-3.5">
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            typeClass("body", "compact"),
            "truncate text-foreground"
          )}
          style={semibold}
        >
          {token.name}
        </span>
        <span
          className={cn(
            typeClass("caption", "compact"),
            "truncate text-muted-foreground"
          )}
        >
          {tokenMeta(token)}
        </span>
      </div>
      <Button
        type="button"
        size="compact"
        variant={confirm ? "primary" : "ghost"}
        className={cn(
          "shrink-0",
          confirm && "[--foreground:var(--destructive)]"
        )}
        onClick={() => (confirm ? onRevoke() : setConfirm(true))}
        onBlur={() => setConfirm(false)}
      >
        {confirm ? "Wirklich widerrufen" : "Widerrufen"}
      </Button>
    </li>
  )
}

/** The token, once: a tab per agent with its ready-to-paste setup. */
function CreatedToken({
  open,
  onOpenChange,
  token,
  setups,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  setups: AgentSetup[]
  onDone: () => void
}) {
  const [tab, setTab] = useState(0)
  const setup = setups[tab]
  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Token erstellt"
      description="Wird nur jetzt angezeigt und gilt, bis du es widerrufst. Richte damit deinen Agenten ein. Für mehrere Apps am besten je ein eigenes Token."
      onSubmit={onDone}
      actions={
        <>
          <Button type="submit" variant="secondary">
            Fertig
          </Button>
          <CopyButton
            key={setup.id}
            variant="primary"
            text={setup.snippet}
            label={setup.copyLabel}
            copiedLabel={setup.copiedLabel}
          />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TabsSubtle
          size="compact"
          selectedIndex={tab}
          onSelect={setTab}
          idPrefix="agent-setup"
          aria-label="Agent"
        >
          {setups.map((s, i) => (
            <TabsSubtleItem key={s.id} index={i} label={s.label} />
          ))}
        </TabsSubtle>
        {setups.map((s, i) => (
          <TabsSubtlePanel
            key={s.id}
            index={i}
            selectedIndex={tab}
            idPrefix="agent-setup"
          >
            <FieldBlock label={s.title} hint={s.hint}>
              <pre
                className={cn(
                  typeClass("caption", "compact"),
                  "rounded-xl bg-muted px-3.5 py-3 font-mono break-all whitespace-pre-wrap text-foreground select-all"
                )}
                data-testid={`setup-${s.id}`}
              >
                {s.snippet}
              </pre>
            </FieldBlock>
          </TabsSubtlePanel>
        ))}
      </div>
      <FieldBlock label="Token">
        <div className="flex h-11 items-center justify-between gap-2 rounded-xl pr-2 pl-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <span
            className={cn(
              typeClass("caption", "compact"),
              "min-w-0 truncate font-mono text-foreground select-all"
            )}
          >
            {token}
          </span>
          <CopyButton
            text={token}
            aria-label="Token kopieren"
            className="shrink-0"
          />
        </div>
      </FieldBlock>
    </OperatorDialog>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-px font-mono text-foreground">
      {children}
    </code>
  )
}
