"use client";

import { Button } from "@/components/ui/button";
import { OperatorDialog, FieldBlock } from "@/components/admin/operator-dialog";
import { CopyButton } from "@/components/admin/copy-button";
import { semibold } from "@/components/admin/text";
import { credentialsText, displayUrl } from "@/lib/admin/format";
import { typeClass } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

// Artboards "Draft angelegt" and "Passwort rotiert": the link and the
// plaintext password, shown this once with copy buttons. The password is
// only in this component's props; closing the dialog drops it.
export function CredentialsDialog({
  open,
  onOpenChange,
  title,
  description,
  url,
  password,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  url: string;
  password: string;
}) {
  return (
    <OperatorDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onSubmit={() => onOpenChange(false)}
      actions={
        <>
          <Button type="submit" variant="secondary">
            Fertig
          </Button>
          <CopyButton
            variant="primary"
            text={credentialsText(url, password)}
            label="Link und Passwort kopieren"
            copiedLabel="Link und Passwort kopiert"
          />
        </>
      }
    >
      <FieldBlock label="Link">
        <div className="flex h-11 items-center justify-between gap-2 rounded-xl pr-2 pl-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <span className={cn(typeClass("subtitle", "compact"), "min-w-0 truncate text-foreground")}>{displayUrl(url)}</span>
          <CopyButton text={url} aria-label="Link kopieren" className="shrink-0" />
        </div>
      </FieldBlock>
      <FieldBlock label="Passwort" hint="Kopiere es jetzt – Draftly speichert nur einen Hash.">
        <div className="flex h-14 items-center justify-between gap-2 rounded-xl bg-muted pr-2 pl-3.5">
          <span
            className={cn(typeClass("display", "compact"), "min-w-0 truncate text-foreground select-all")}
            style={semibold}
            data-testid="draft-password"
          >
            {password}
          </span>
          <CopyButton text={password} aria-label="Passwort kopieren" className="shrink-0 bg-card" />
        </div>
      </FieldBlock>
    </OperatorDialog>
  );
}
