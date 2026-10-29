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
import { TOKEN_PLACEHOLDER, agentSetups, tokenMeta } from "@/lib/admin/format"
import type { ApiToken } from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// "Agenten" from the sidebar footer (ADR 0004): API tokens for the MCP
// endpoint. The setup for Claude Code, Cursor and any other remote-MCP agent
// is always on screen, filled in with the selected token; the operator can
// read every token again (ADR 0004 amendment).

/** undefined = not loaded yet, null = made before tokens were stored. */
type Revealed = Record<string, string | null | undefined>

export function AgentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const origin = useOrigin()
  const [tokens, setTokens] = useState<ApiToken[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Revealed>({})
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let live = true
    void operatorApi.listTokens().then((res) => {
      if (!live) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTokens(res.data)
      setSelected((s) => s ?? res.data[0]?.id ?? null)
    })
    return () => {
      live = false
    }
  }, [])

  // Read the selected token once; later selections reuse it.
  useEffect(() => {
    if (!selected || revealed[selected] !== undefined) return
    let live = true
    void operatorApi.readToken(selected).then((res) => {
      if (live && res.ok)
        setRevealed((r) => ({ ...r, [selected]: res.data.token }))
    })
    return () => {
      live = false
    }
  }, [selected, revealed])

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
    const { apiToken, token } = res.data
    setTokens((t) => [apiToken, ...(t ?? [])])
    setRevealed((r) => ({ ...r, [apiToken.id]: token }))
    setSelected(apiToken.id)
    setName("")
  }

  const revoke = async (id: string) => {
    const res = await operatorApi.revokeToken(id)
    if (!res.ok && res.status !== 404) {
      setError(res.error)
      return
    }
    const rest = (tokens ?? []).filter((x) => x.id !== id)
    setTokens(rest)
    if (selected === id) setSelected(rest[0]?.id ?? null)
  }

  const current = tokens?.find((t) => t.id === selected) ?? null
  const plaintext = current ? revealed[current.id] : undefined

  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      list
      title="Agenten"
      description="Ein Agent wie Claude Code oder Cursor wandelt Paper-Frames selbst in Seiten um und lädt sie hoch. Am besten ein Token pro App: jedes lässt sich einzeln widerrufen."
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
          placeholder="z. B. Cursor auf dem MacBook"
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

      <FieldBlock label="Tokens">
        {tokens === null ? (
          <Muted>Lädt …</Muted>
        ) : tokens.length === 0 ? (
          <Muted>Noch keine Tokens. Erstelle oben eines.</Muted>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl shadow-[inset_0_0_0_1px_var(--border)]">
            {tokens.map((t) => (
              <TokenRow
                key={t.id}
                token={t}
                selected={t.id === selected}
                onSelect={() => setSelected(t.id)}
                onRevoke={() => revoke(t.id)}
              />
            ))}
          </ul>
        )}
      </FieldBlock>

      <SetupGuide
        origin={origin}
        tokenName={current?.name ?? null}
        token={plaintext}
      />
    </OperatorDialog>
  )
}

/** The setup per agent, with the selected token filled in (or a placeholder). */
function SetupGuide({
  origin,
  tokenName,
  token,
}: {
  origin: string
  tokenName: string | null
  token: string | null | undefined
}) {
  const [tab, setTab] = useState(0)
  const setups = agentSetups(origin, token || TOKEN_PLACEHOLDER)
  const label = tokenName ? `Einrichtung mit „${tokenName}“` : "Einrichtung"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            typeClass("caption", "compact"),
            "min-w-0 truncate text-muted-foreground"
          )}
        >
          {label}
        </span>
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
      </div>
      {setups.map((s, i) => (
        <TabsSubtlePanel
          key={s.id}
          index={i}
          selectedIndex={tab}
          idPrefix="agent-setup"
          className="flex flex-col gap-1.5"
        >
          <div className="flex min-h-7 items-center justify-between gap-2">
            <span
              className={cn(typeClass("body", "compact"), "text-foreground")}
              style={semibold}
            >
              {s.title}
            </span>
            {token ? (
              <CopyButton
                size="compact"
                text={s.snippet}
                label={s.copyLabel}
                copiedLabel={s.copiedLabel}
              />
            ) : null}
          </div>
          <pre
            className={cn(
              typeClass("caption", "compact"),
              "rounded-xl bg-muted px-3.5 py-3 font-mono break-all whitespace-pre-wrap text-foreground select-all"
            )}
            data-testid={`setup-${s.id}`}
          >
            {s.snippet}
          </pre>
          <Muted>{s.hint}</Muted>
        </TabsSubtlePanel>
      ))}
      {token === null ? (
        <p
          role="alert"
          className={cn(typeClass("caption", "compact"), "text-destructive")}
        >
          Dieses Token wurde erstellt, bevor Draftly Tokens gespeichert hat, und
          lässt sich nicht mehr anzeigen. Widerrufe es und erstelle ein neues.
        </p>
      ) : !tokenName ? (
        <Muted>
          Mit einem Token steht es hier schon eingesetzt. MCP-URL{" "}
          <Code>{origin}/api/mcp</Code>.
        </Muted>
      ) : null}
      <Muted>
        Für Agenten ohne MCP-Prompts gibt es den Skill auch als{" "}
        <a
          href="/api/admin/agent/skill"
          download
          className="text-foreground underline underline-offset-2"
        >
          SKILL.md
        </a>
        .
      </Muted>
    </div>
  )
}

/** Clicking the row shows its setup; revoking asks once more on the same button. */
function TokenRow({
  token,
  selected,
  onSelect,
  onRevoke,
}: {
  token: ApiToken
  selected: boolean
  onSelect: () => void
  onRevoke: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 py-1.5 pr-2 pl-1.5 first:rounded-t-xl last:rounded-b-xl",
        selected && "bg-muted"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
      >
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
      </button>
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

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className={cn(typeClass("caption", "compact"), "text-muted-foreground")}>
      {children}
    </p>
  )
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-px font-mono text-foreground">
      {children}
    </code>
  )
}
