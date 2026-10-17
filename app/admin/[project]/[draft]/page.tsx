import { notFound } from "next/navigation";
import { getDraft, isOperator } from "@/lib/server/queries";
import { ReviewerLink } from "@/components/admin/reviewer-link";
import { PageHeader } from "@/components/admin/text";
import { ShareCard } from "@/components/admin/share-card";
import { PagesSection } from "@/components/admin/pages-section";
import { DeleteDraft } from "@/components/admin/delete-draft";

// Artboards "Draft" / "Draft · Aktionen" and the dialogs opened from it.
export default async function OperatorDraftPage({
  params,
}: {
  params: Promise<{ project: string; draft: string }>;
}) {
  if (!(await isOperator())) return null;
  const { project, draft: slug } = await params;
  const draft = await getDraft(project, slug);
  if (!draft) notFound();

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Projekte", href: "/admin" },
          { label: draft.projectSlug, href: `/admin/${draft.projectSlug}` },
        ]}
        title={draft.slug}
        action={<ReviewerLink projectSlug={draft.projectSlug} draftSlug={draft.slug} />}
      />
      <ShareCard key={`${draft.projectSlug}/${draft.slug}`} draft={draft} />
      <PagesSection draft={draft} />
      <DeleteDraft draft={draft} />
    </>
  );
}
