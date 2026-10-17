import "server-only";

// Read-side entry points for server components (app/admin/**, app/[project]/[draft]).
// Signatures are fixed by .scratch/draftly/api-contract.md; the backend fills the bodies.
// They read cookies through next/headers, so call them only during a request.

import type { Draft, DraftSnapshot, Project } from "@/lib/api-types";

export type DraftAccess =
  | { status: "missing" }
  | { status: "locked"; projectTitle: string; draftSlug: string }
  | { status: "open"; snapshot: DraftSnapshot };

/** True when the request carries a valid operator session cookie. */
export async function isOperator(): Promise<boolean> {
  throw new Error("not implemented");
}

/** Gate decision for `/<project>/<draft>`: 404, password gate, or viewer data. */
export async function getDraftAccess(
  projectSlug: string,
  draftSlug: string,
): Promise<DraftAccess> {
  void projectSlug;
  void draftSlug;
  throw new Error("not implemented");
}

/** Operator only (caller checks isOperator first). Newest first. */
export async function listProjects(): Promise<Project[]> {
  throw new Error("not implemented");
}

/** Operator only. Null when the project does not exist. */
export async function getProject(projectSlug: string): Promise<Project | null> {
  void projectSlug;
  throw new Error("not implemented");
}

/** Operator only. Null when the draft does not exist. */
export async function getDraft(projectSlug: string, draftSlug: string): Promise<Draft | null> {
  void projectSlug;
  void draftSlug;
  throw new Error("not implemented");
}
