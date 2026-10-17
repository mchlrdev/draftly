import { notFound } from "next/navigation";
import { getProject, isOperator } from "@/lib/server/queries";
import { EmptyState, PageHeader } from "@/components/admin/text";
import { LinkCardList } from "@/components/admin/link-card-list";
import { NewDraftButton } from "@/components/admin/new-draft-dialog";
import { DeleteProject } from "@/components/admin/delete-project";
import { draftMeta } from "@/lib/admin/format";

// Artboard "Projekt".
export default async function OperatorProjectPage({ params }: { params: Promise<{ project: string }> }) {
  if (!(await isOperator())) return null;
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const now = new Date();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projekte", href: "/admin" }, { label: project.slug }]}
        title={project.title || project.slug}
        action={<NewDraftButton projectSlug={project.slug} takenSlugs={project.drafts.map((d) => d.slug)} />}
      />
      {project.drafts.length === 0 ? (
        <EmptyState title="Noch kein Draft.">
          Ein Draft ist ein Link mit eigenem Passwort, z. B. /{project.slug}/v1. Er hält eine oder mehrere Seiten.
        </EmptyState>
      ) : (
        <LinkCardList
          label="Drafts"
          items={project.drafts.map((d) => ({
            key: d.slug,
            href: `/admin/${project.slug}/${d.slug}`,
            title: d.slug,
            meta: draftMeta(d, now),
          }))}
        />
      )}
      <DeleteProject slug={project.slug} title={project.title || project.slug} draftCount={project.drafts.length} />
    </>
  );
}
