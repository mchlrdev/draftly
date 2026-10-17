import { isOperator, listProjects } from "@/lib/server/queries"
import { EmptyState } from "@/components/admin/text"

// /admin: the sidebar is the navigation, so the page only points at it.
export default async function OperatorHomePage() {
  if (!(await isOperator())) return null
  const projects = await listProjects()

  return projects.length === 0 ? (
    <EmptyState title="Noch kein Projekt.">
      Leg links mit „Neues Projekt“ eins an. Ein Projekt gruppiert Drafts, sein
      Slug steht vorne in jeder Draft-URL.
    </EmptyState>
  ) : (
    <EmptyState title="Wähle links einen Draft.">
      Die Seitenleiste zeigt alle Projekte. Klapp eines auf, um seine Drafts zu
      sehen, oder leg mit „Neuer Draft“ einen an.
    </EmptyState>
  )
}
