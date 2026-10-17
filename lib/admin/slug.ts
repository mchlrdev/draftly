// Client-side slug checks for the operator forms. The server is the authority
// (422 / 409 from the API); these only give the message before the request.

import { RESERVED_SLUGS, SLUG_PATTERN } from "../api-types"

export type SlugKind = "project" | "draft"

/** German message for a slug the form should not submit, or null when it is fine.
 *  `taken` are the slugs already used at this level (projects, or drafts in the project). */
export function slugProblem(
  slug: string,
  kind: SlugKind,
  taken: readonly string[] = []
): string | null {
  if (slug === "") return null
  if (
    kind === "project" &&
    (RESERVED_SLUGS as readonly string[]).includes(slug)
  ) {
    return "„admin“ und „api“ sind reserviert. Nimm einen anderen Slug."
  }
  if (slug.length > 64) return "Höchstens 64 Zeichen."
  if (/[A-Z]/.test(slug)) return "Nur Kleinbuchstaben, Zahlen und Bindestriche."
  if (!SLUG_PATTERN.test(slug)) {
    if (/^-|-$/.test(slug)) return "Kein Bindestrich am Anfang oder Ende."
    return "Nur Kleinbuchstaben, Zahlen und Bindestriche."
  }
  if (taken.includes(slug)) {
    return kind === "project"
      ? "Diesen Slug gibt es schon."
      : "Diesen Draft gibt es in diesem Projekt schon."
  }
  return null
}

/** A slug suggestion from a free-text title: "Tanjas Wellness-Oase" → "tanjas-wellness-oase". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "")
}
