"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField, InputGroup } from "@/components/ui/input-group";
import { OperatorDialog, CancelButton, DangerButton, ErrorText } from "@/components/admin/operator-dialog";
import { DangerZone, semibold } from "@/components/admin/text";
import { operatorApi } from "@/lib/admin/api";
import { deleteProjectAction, deleteProjectText } from "@/lib/admin/format";

// Artboard "Projekt löschen". An empty project goes after a plain confirm.
// One with drafts (known from the page, or learned from a 409) asks for the
// slug to be typed, then deletes with ?force=1.
export function DeleteProject({ slug, title, draftCount }: { slug: string; title: string; draftCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(draftCount);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const needsForce = count > 0;
  const canSubmit = !pending && (!needsForce || typed === slug);

  const start = () => {
    setCount(draftCount);
    setTyped("");
    setError(null);
    setPending(false);
    setOpen(true);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    const res = await operatorApi.deleteProject(slug, needsForce);
    if (res.ok) {
      setOpen(false);
      router.push("/admin");
      router.refresh();
      return;
    }
    setPending(false);
    if (res.status === 409) {
      // Drafts appeared since the page rendered: ask for the typed confirm.
      setCount((c) => Math.max(c, 1));
      router.refresh();
      return;
    }
    setError(res.error);
  };

  return (
    <>
      <DangerZone text="Ein Projekt löschen nimmt alle Drafts und ihre Links mit.">
        <Button variant="ghost" className="text-destructive hover:text-destructive" style={semibold} onClick={start}>
          Projekt löschen
        </Button>
      </DangerZone>
      <OperatorDialog
        open={open}
        onOpenChange={setOpen}
        title="Projekt löschen?"
        description={
          needsForce
            ? deleteProjectText(title, count)
            : `„${title}“ hat keine Drafts. Das Projekt verschwindet aus der Liste.`
        }
        onSubmit={submit}
        actions={
          <>
            <CancelButton onClick={() => setOpen(false)} />
            <DangerButton type="submit" disabled={!canSubmit} loading={pending}>
              {needsForce ? deleteProjectAction(count) : "Projekt löschen"}
            </DangerButton>
          </>
        }
      >
        {needsForce && (
          <InputGroup className="w-full">
            <InputField
              index={0}
              label={`Zum Bestätigen den Slug tippen: ${slug}`}
              placeholder={slug}
              value={typed}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(v) => {
                setTyped(v.trim());
                setError(null);
              }}
              error={error ?? undefined}
            />
          </InputGroup>
        )}
        {!needsForce && error && <ErrorText>{error}</ErrorText>}
      </OperatorDialog>
    </>
  );
}
