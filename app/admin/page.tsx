import { isOperator, listProjects } from "@/lib/server/queries"
import { EmptyState, PageHeader } from "@/components/admin/text"
import { LinkCardList } from "@/components/admin/link-card-list"
import { NewProjectButton } from "@/components/admin/new-project-dialog"
import { projectMeta } from "@/lib/admin/format"

// Artboards "Projekte" and "Projekte · Leer".
export default async function OperatorProjectsPage() {
  if (!(await isOperator())) return null
  const projects = await listProjects()

  return (
    <>
      <PageHeader
        title="Projekte"
        action={<NewProjectButton takenSlugs={projects.map((p) => p.slug)} />}
      />
      {projects.length === 0 ? (
        <EmptyState title="Noch kein Projekt.">
          Ein Projekt gruppiert zusammengehörige Drafts. Sein Slug steht vorne
          in jeder Draft-URL, z. B. draftly.mchlr.de/tanjas-oase/v4.
        </EmptyState>
      ) : (
        <LinkCardList
          label="Projekte"
          items={projects.map((p) => ({
            key: p.slug,
            href: `/admin/${p.slug}`,
            title: p.title || p.slug,
            meta: projectMeta(p),
          }))}
        />
      )}
    </>
  )
}
