"use client";

import { Button } from "@/components/ui/button";

/** "Als Reviewer ansehen": the public draft URL in a new tab. The operator
 *  session skips the password gate there. */
export function ReviewerLink({ projectSlug, draftSlug }: { projectSlug: string; draftSlug: string }) {
  return (
    <Button variant="secondary" render={<a href={`/${projectSlug}/${draftSlug}`} target="_blank" rel="noopener" />}>
      Als Reviewer ansehen
    </Button>
  );
}
