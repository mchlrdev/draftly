import { isOperator, listProjects } from "@/lib/server/queries"
import { EmptyState } from "@/components/admin/text"

// /admin: the sidebar is the navigation, so the page only points at it.
export default async function OperatorHomePage() {
  if (!(await isOperator())) return null
  const projects = await listProjects()

  return projects.length === 0 ? (
    <EmptyState title="Noch kein Projekt.">
      Lege links ein Projekt an. Es gruppiert Drafts, und sein Slug steht in
      jeder Draft-URL.
    </EmptyState>
  ) : (
    <EmptyState title="Wähle links einen Draft.">
      Klapp links ein Projekt auf, um seine Drafts zu sehen, oder lege mit
      „Draft anlegen“ einen neuen an.
    </EmptyState>
  )
}
