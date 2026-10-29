// German copy and small formatters for the operator UI. Pure, so they can be
// unit-tested and called from server and client components alike.

import type { DisplayMode, DraftSummary, Page, Project } from "@/lib/api-types"
// Relative: the unit tests run without the "@/" alias for values.
import { DEFAULT_DESIGN_WIDTH } from "../api-types"

/** "Fix · 1440" or "Fill". */
export function displayLabel(
  page: Pick<Page, "display" | "designWidth">
): string {
  return page.display === "fixed" ? `Fix · ${page.designWidth}` : "Fill"
}

export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function pagesLabel(n: number): string {
  return n === 0 ? "noch keine Seite" : countLabel(n, "Seite", "Seiten")
}

export function openCommentsLabel(n: number): string {
  if (n === 0) return "keine offenen Kommentare"
  return n === 1 ? "1 offener Kommentar" : `${n} offene Kommentare`
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** "vor 2 Tagen", "vor 3 Wochen", "gerade eben". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 60) return "gerade eben"
  const fmt = new Intl.RelativeTimeFormat("de", { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return fmt.format(-Math.floor(seconds / size), unit)
  }
  return "gerade eben"
}

/** "project-name · 2 Drafts". */
export function projectMeta(project: Pick<Project, "slug" | "drafts">): string {
  return `${project.slug} · ${countLabel(project.drafts.length, "Draft", "Drafts")}`
}

/** "2 Seiten · 3 offene Kommentare · vor 2 Tagen". */
export function draftMeta(draft: DraftSummary, now: Date = new Date()): string {
  return [
    pagesLabel(draft.pageCount),
    openCommentsLabel(draft.openThreadCount),
    relativeTime(draft.createdAt, now),
  ].join(" · ")
}

/** Public draft URL without the scheme, as the UI shows it: "draftly.mchlr.de/project-name/v4". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "")
}

export function draftUrl(
  origin: string,
  projectSlug: string,
  draftSlug: string
): string {
  return `${origin}/${projectSlug}/${draftSlug}`
}

/** What "Link und Passwort kopieren" puts on the clipboard. */
export function credentialsText(url: string, password: string): string {
  return `${url}\nPasswort: ${password}`
}

/** Body of the "Draft löschen" confirmation. */
export function deleteDraftText(
  url: string,
  draft: Pick<DraftSummary, "pageCount" | "openThreadCount">
): string {
  const pages =
    draft.pageCount === 0
      ? null
      : draft.pageCount === 1
        ? "Die Seite"
        : draft.pageCount === 2
          ? "Beide Seiten"
          : `Alle ${draft.pageCount} Seiten`
  const comments =
    draft.openThreadCount === 0
      ? "alle Kommentare"
      : draft.openThreadCount === 1
        ? "1 offener Kommentar"
        : `${draft.openThreadCount} offene Kommentare`
  const gone = pages
    ? `${pages} und ${comments} sind weg.`
    : "Alle Kommentare sind weg."
  return `${displayUrl(url)} zeigt danach 404. ${gone}`
}

/** Body of the "Projekt löschen?" confirmation for a project that still has drafts. */
export function deleteProjectText(title: string, draftCount: number): string {
  return `„${title}“ hat ${countLabel(draftCount, "Draft", "Drafts")}. Danach sind alle Links, Seiten und Kommentare weg.`
}

export function deleteProjectAction(draftCount: number): string {
  return `Projekt und ${countLabel(draftCount, "Draft", "Drafts")} löschen`
}

/** "184 KB" (at least 1 KB). */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "angebot.html" → "Angebot", "kontakt-seite.htm" → "Kontakt seite". */
export function nameFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ""
}

// XML namespaces and DTD ids (`xmlns="http://www.w3.org/2000/svg"`, the
// XHTML doctype) are identifiers, never fetched, so every inline SVG has one.
const W3C_IDENTIFIER = /^https?:\/\/www\.w3\.org\//i

/** Every `http:` / `https:` URL in the HTML, in order, as the server rejects them. */
export function findExternalUrls(html: string): string[] {
  const urls: string[] = []
  const re = /https?:[^\s"'<>()]*/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) if (!W3C_IDENTIFIER.test(m[0])) urls.push(m[0])
  return urls
}

/** Shortens a long URL for the message: "https://app.paper.design/…/hero.png". */
export function shortUrl(url: string): string {
  const m = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url)
  if (!m || !m[2]) return url
  const parts = m[2].split("/").filter(Boolean)
  if (parts.length <= 1) return url
  return `${m[1]}/…/${parts[parts.length - 1]}`
}

export function externalUrlMessage(urls: readonly string[]): string {
  const n = urls.length
  const first = shortUrl(urls[0] ?? "http:")
  const found =
    n === 1
      ? `Externe URL gefunden: ${first}.`
      : `${n} externe URLs gefunden, z. B. ${first}.`
  return `${found} Bilder und Fonts bitte inline einbetten.`
}

/** Normalises a colour from the picker to the API's `#RRGGBB`, or null. */
export function normalizeHex(value: string): string | null {
  const v = value.trim().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(v)) {
    return `#${v
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`
  }
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v))
    return `#${v.slice(0, 6).toUpperCase()}`
  return null
}

/** Validates the design width field: integer 320–7680. */
export function designWidthProblem(
  value: string,
  display: DisplayMode
): string | null {
  if (display === "fill") return null
  if (!/^\d+$/.test(value.trim()))
    return "Bitte eine ganze Zahl in px eingeben."
  const n = Number(value)
  if (n < 320 || n > 7680)
    return "Bitte einen Wert zwischen 320 und 7680 px eingeben."
  return null
}

/**
 * The design width to send. A Fill page keeps a width for a later switch to
 * Fix; its field is hidden, so an invalid value falls back to the default
 * instead of blocking the upload.
 */
export function designWidthValue(value: string): number {
  return designWidthProblem(value, "fixed") === null
    ? Number(value)
    : DEFAULT_DESIGN_WIDTH
}

export type AgentId = "claude" | "cursor" | "other"

export interface AgentSetup {
  id: AgentId
  /** Tab label. */
  label: string
  /** What the snippet is, above it. */
  title: string
  snippet: string
  copyLabel: string
  copiedLabel: string
  /** Where it goes and how to check it worked. */
  hint: string
}

/** Stands in for the token in the setup until one is selected. */
export const TOKEN_PLACEHOLDER = "dft_DEIN_TOKEN"

/** How each agent reaches Draftly's MCP server, with the new token filled in. */
export function agentSetups(origin: string, token: string): AgentSetup[] {
  const url = `${origin}/api/mcp`
  return [
    {
      id: "claude",
      label: "Claude Code",
      title: "Im Terminal ausführen",
      snippet: `claude mcp add --scope user --transport http draftly ${url} --header "Authorization: Bearer ${token}"`,
      copyLabel: "Befehl kopieren",
      copiedLabel: "Befehl kopiert",
      hint: "Gilt danach in allen Projekten. Prüfen mit „claude mcp list“. Den Skill bringt der Server mit: /mcp__draftly__paper-to-draftly.",
    },
    {
      id: "cursor",
      label: "Cursor",
      title: "In ~/.cursor/mcp.json einfügen",
      snippet: JSON.stringify(
        {
          mcpServers: {
            draftly: { url, headers: { Authorization: `Bearer ${token}` } },
          },
        },
        null,
        2
      ),
      copyLabel: "JSON kopieren",
      copiedLabel: "JSON kopiert",
      hint: "Gibt es die Datei schon, nur den Eintrag „draftly“ unter mcpServers ergänzen. Prüfen unter Cursor Settings → MCP. Den Skill als SKILL.md nach ~/.cursor/skills/paper-to-draftly/ legen.",
    },
    {
      id: "other",
      label: "Andere",
      title: "Remote-MCP (Streamable HTTP)",
      snippet: `URL:    ${url}\nHeader: Authorization: Bearer ${token}`,
      copyLabel: "Kopieren",
      copiedLabel: "Kopiert",
      hint: "Für jeden Agenten, der MCP über HTTP mit eigenem Header kann. Kennt er keine MCP-Prompts, den Skill als SKILL.md mitgeben.",
    },
  ]
}

/** "erstellt vor 2 Tagen · zuletzt benutzt gerade eben". */
export function tokenMeta(
  token: { createdAt: string; lastUsedAt: string | null },
  now: Date = new Date()
): string {
  const used = token.lastUsedAt
    ? `zuletzt benutzt ${relativeTime(token.lastUsedAt, now)}`
    : "noch nie benutzt"
  return `erstellt ${relativeTime(token.createdAt, now)} · ${used}`
}
