import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDraftAccess } from "@/lib/server/queries";
import { SLUG_PATTERN } from "@/lib/api-types";
import { PasswordGate } from "@/components/reviewer/password-gate";
import { Viewer } from "@/components/reviewer/viewer";

export const metadata: Metadata = {
  title: "Draftly",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ project: string; draft: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export default async function DraftPage({ params, searchParams }: Props) {
  const { project, draft } = await params;
  if (!SLUG_PATTERN.test(project) || !SLUG_PATTERN.test(draft)) notFound();

  const access = await getDraftAccess(project, draft);
  if (access.status === "missing") notFound();

  if (access.status === "locked") {
    return (
      <PasswordGate
        project={project}
        draft={draft}
        projectTitle={access.projectTitle}
        draftSlug={access.draftSlug}
      />
    );
  }

  const { page } = await searchParams;
  return (
    <Viewer
      project={project}
      draft={draft}
      initialSnapshot={access.snapshot}
      initialPageId={typeof page === "string" ? page : undefined}
    />
  );
}
