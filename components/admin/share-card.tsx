"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OperatorDialog, CancelButton, ErrorText } from "@/components/admin/operator-dialog";
import { CopyButton } from "@/components/admin/copy-button";
import { CredentialsDialog } from "@/components/admin/credentials-dialog";
import { LetterboxPicker } from "@/components/admin/letterbox-picker";
import { cardClass, semibold } from "@/components/admin/text";
import { useOrigin } from "@/components/admin/use-origin";
import { operatorApi } from "@/lib/admin/api";
import { displayUrl, draftUrl } from "@/lib/admin/format";
import type { Draft } from "@/lib/api-types";
import { typeClass } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

// The "Share" card of artboard "Draft · Aktionen": link (copy), password
// (rotate → "Passwort rotieren" → "Passwort rotiert"), letterbox (change).
export function ShareCard({ draft }: { draft: Draft }) {
  const router = useRouter();
  const origin = useOrigin();
  const url = draftUrl(origin, draft.projectSlug, draft.slug);

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [credsOpen, setCredsOpen] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [letterbox, setLetterbox] = useState(draft.letterbox);
  const saved = useRef(draft.letterbox);
  const [letterboxError, setLetterboxError] = useState<string | null>(null);

  const rotate = async () => {
    setRotating(true);
    const res = await operatorApi.rotatePassword(draft.projectSlug, draft.slug);
    setRotating(false);
    if (!res.ok) {
      setRotateError(res.error);
      return;
    }
    setRotateOpen(false);
    setPassword(res.data.password);
    setCredsOpen(true);
  };

  const saveLetterbox = async () => {
    if (letterbox === saved.current) return;
    const res = await operatorApi.updateDraft(draft.projectSlug, draft.slug, letterbox);
    if (!res.ok) {
      setLetterboxError(res.error);
      setLetterbox(saved.current);
      return;
    }
    saved.current = res.data.letterbox;
    setLetterboxError(null);
    router.refresh();
  };

  return (
    <section aria-label="Teilen" className={cn(cardClass, "flex flex-col gap-2 px-5 py-3")}>
      <Row label="Link" action={<CopyButton variant="ghost" className="text-foreground" text={url} aria-label="Link kopieren" />}>
        <span className="truncate">{displayUrl(url)}</span>
      </Row>
      <Row
        label="Passwort"
        action={
          <Button
            variant="ghost"
            className="text-foreground"
            style={semibold}
            onClick={() => {
              setRotateError(null);
              setRotateOpen(true);
            }}
          >
            Rotieren
          </Button>
        }
      >
        Nur beim Anlegen sichtbar · danach rotieren
      </Row>
      <Row
        label="Letterbox"
        action={
          <Button variant="ghost" className="text-foreground" style={semibold} onClick={() => setPickerOpen(true)}>
            Ändern
          </Button>
        }
      >
        <span className="flex flex-col gap-1">
          <LetterboxPicker
            value={letterbox}
            onChange={setLetterbox}
            open={pickerOpen}
            onOpenChange={(next) => {
              setPickerOpen(next);
              if (!next) void saveLetterbox();
            }}
          />
          {letterboxError && <ErrorText>{letterboxError}</ErrorText>}
        </span>
      </Row>

      <OperatorDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Passwort rotieren?"
        description={`Draftly erzeugt ein neues Passwort für ${draft.slug}. Das alte funktioniert danach nicht mehr. Link, Seiten und Kommentare bleiben.`}
        onSubmit={rotate}
        actions={
          <>
            <CancelButton onClick={() => setRotateOpen(false)} />
            <Button type="submit" variant="primary" loading={rotating}>
              Neues Passwort erzeugen
            </Button>
          </>
        }
      >
        {rotateError && <ErrorText>{rotateError}</ErrorText>}
      </OperatorDialog>

      {password && (
        <CredentialsDialog
          open={credsOpen}
          onOpenChange={setCredsOpen}
          title={`Neues Passwort für ${draft.slug}`}
          description={`Das alte Passwort funktioniert ab sofort nicht mehr. Schick das neue an alle, die ${draft.slug} ansehen sollen.`}
          url={url}
          password={password}
        />
      )}
    </section>
  );
}

function Row({ label, children, action }: { label: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span className={cn(typeClass("body", "compact"), "w-23 shrink-0 text-muted-foreground")}>{label}</span>
      <div className={cn(typeClass("subtitle", "compact"), "flex min-w-0 grow items-center text-foreground")}>{children}</div>
      <div className="flex w-28 shrink-0 justify-end">{action}</div>
    </div>
  );
}
