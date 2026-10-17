import "server-only"

import type { NextRequest } from "next/server"
import { hasDraftCookie, isOperatorCookie, type CookieReader } from "./auth"
import { HttpError } from "./http"
import { findDraft, type DraftRow } from "./store"

export interface DraftAccess {
  draft: DraftRow
  operator: boolean
}

export function draftAccessFor(
  cookies: CookieReader,
  project: string,
  draft: string
): DraftAccess | "missing" | "locked" {
  const operator = isOperatorCookie(cookies)
  const row = findDraft(project, draft)
  if (!row) return operator ? "missing" : "locked"
  if (operator || hasDraftCookie(cookies, row.id, row.password_hash))
    return { draft: row, operator }
  return "locked"
}

/**
 * Reviewer routes: draft cookie or operator session. Without access → 401 with
 * the same body whether or not the draft exists; unknown draft → 404 only for
 * the operator.
 */
export function requireDraftAccess(
  req: NextRequest,
  project: string,
  draft: string
): DraftAccess {
  const access = draftAccessFor(req.cookies, project, draft)
  if (access === "missing") throw new HttpError(404, "Entwurf nicht gefunden.")
  if (access === "locked")
    throw new HttpError(401, "Bitte gib das Passwort ein.")
  return access
}

export function requireOperatorAccess(access: DraftAccess): void {
  if (!access.operator) throw new HttpError(403, "Nur für die Betreiberin.")
}
