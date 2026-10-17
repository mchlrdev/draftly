"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OperatorDialog, CancelButton, DangerButton, ErrorText } from "@/components/admin/operator-dialog";
import { DangerZone, semibold } from "@/components/admin/text";
import { useOrigin } from "@/components/admin/use-origin";
import { operatorApi } from "@/lib/admin/api";
import { deleteDraftText, draftUrl } from "@/lib/admin/format";
import type { Draft } from "@/lib/api-types";

// Artboard "Draft löschen".
export function DeleteDraft({ draft }: { draft: Draft }) {
  const router = useRouter();
  const origin = useOrigin();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    const res = await operatorApi.deleteDraft(draft.projectSlug, draft.slug);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    setOpen(false);
    router.push(`/admin/${draft.projectSlug}`);
    router.refresh();
  };

  return (
    <>
      <DangerZone text="Den Draft löschen macht den Link sofort ungültig. Kommentare gehen mit.">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          style={semibold}
          onClick={() => {
            setError(null);
            setPending(false);
            setOpen(true);
          }}
        >
          Draft löschen
        </Button>
      </DangerZone>
      <OperatorDialog
        open={open}
        onOpenChange={setOpen}
        title={`${draft.slug} löschen?`}
        description={deleteDraftText(draftUrl(origin, draft.projectSlug, draft.slug), draft)}
        onSubmit={submit}
        actions={
          <>
            <CancelButton onClick={() => setOpen(false)} />
            <DangerButton type="submit" loading={pending}>
              Draft löschen
            </DangerButton>
          </>
        }
      >
        {error && <ErrorText>{error}</ErrorText>}
      </OperatorDialog>
    </>
  );
}
