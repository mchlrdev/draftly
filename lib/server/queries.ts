import "server-only"

// Read-side entry points for server components (app/admin/**, app/[project]/[draft]).
// Signatures are fixed by .scratch/draftly/api-contract.md; the backend fills the bodies.
// They read cookies through next/headers, so call them only during a request.

import { cookies } from "next/headers"
import type { Draft, DraftSnapshot, Project } from "@/lib/api-types"
import { draftAccessFor } from "./access"
import { isOperatorCookie } from "./auth"
import * as store from "./store"

export type DraftAccess =
  | { status: "missing" }
  | { status: "locked"; projectTitle: string; draftSlug: string }
  | { status: "open"; snapshot: DraftSnapshot }

/** True when the request carries a valid operator session cookie. */
export async function isOperator(): Promise<boolean> {
  return isOperatorCookie(await cookies())
}

/** Gate decision for `/<project>/<draft>`: 404, password gate, or viewer data. */
export async function getDraftAccess(
  projectSlug: string,
  draftSlug: string
): Promise<DraftAccess> {
  const row = store.findDraft(projectSlug, draftSlug)
  if (!row) return { status: "missing" }
  const access = draftAccessFor(await cookies(), projectSlug, draftSlug)
  if (access === "missing") return { status: "missing" }
  if (access === "locked")
    return {
      status: "locked",
      projectTitle: row.project_title,
      draftSlug: row.slug,
    }
  return {
    status: "open",
    snapshot: store.snapshot(access.draft, access.operator),
  }
}

/** Operator only. The name set in /admin, or null. */
export async function getOperatorName(): Promise<string | null> {
  return store.getOperatorName()
}

/** Operator only (caller checks isOperator first). Newest first. */
export async function listProjects(): Promise<Project[]> {
  return store.listProjects()
}

/** Operator only. Null when the project does not exist. */
export async function getProject(projectSlug: string): Promise<Project | null> {
  return store.getProject(projectSlug)
}

/** Operator only. Null when the draft does not exist. */
export async function getDraft(
  projectSlug: string,
  draftSlug: string
): Promise<Draft | null> {
  const row = store.findDraft(projectSlug, draftSlug)
  return row ? store.toDraft(row) : null
}
