"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { CenteredCard, CardHeading } from "@/components/reviewer/centered-card";
import { useSize } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import { saveName, useIdentity } from "@/lib/reviewer/identity";
import { ApiError, reviewerApi } from "@/lib/reviewer/api";

// Artboards Passwort / Passwort · Fehler. Name and password in one form; the
// name is remembered in this browser and prefilled, and the composer later
// shows it instead of asking again.

const WRONG_PASSWORD = "Falsches Passwort. Bitte erneut versuchen.";

export function PasswordGate({
  project,
  draft,
  projectTitle,
  draftSlug,
}: {
  project: string;
  draft: string;
  projectTitle: string;
  draftSlug: string;
}) {
  const router = useRouter();
  const size = useSize();
  const identity = useIdentity();
  // Null until the reviewer types: until then the remembered name shows.
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? identity?.name ?? "";
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const nextNameError = trimmed ? (trimmed.length > 60 ? "Höchstens 60 Zeichen." : undefined) : "Bitte gib deinen Namen ein.";
    const nextPasswordError = password ? undefined : "Bitte gib das Passwort ein.";
    setNameError(nextNameError);
    setPasswordError(nextPasswordError);
    if (nextNameError || nextPasswordError) return;

    setPending(true);
    try {
      await reviewerApi.unlock({ project, draft }, password);
      saveName(trimmed);
      router.refresh();
      // Stay pending: the server swaps this gate for the viewer.
    } catch (err) {
      setPending(false);
      setPasswordError(err instanceof ApiError && err.status === 401 ? WRONG_PASSWORD : errorMessage(err));
    }
  }

  return (
    <CenteredCard>
      <CardHeading title={projectTitle} subtitle={draftSlug} className="pb-5" />
      {/* POST, and no submit before hydration: a native submit must never put
          the password into the URL. */}
      <form method="post" onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-3">
        <InputGroup className="w-full">
          <InputField
            index={0}
            label="Dein Name"
            labelHidden
            placeholder="Dein Name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
            name="name"
            autoComplete="nickname"
            maxLength={60}
          />
          <InputField
            index={1}
            label="Passwort"
            labelHidden
            placeholder="Passwort"
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(undefined);
            }}
            error={passwordError}
            name="password"
            autoComplete="current-password"
          />
        </InputGroup>
        <Button type="submit" variant="primary" loading={pending} disabled={identity === null} className="w-full">
          Öffnen
        </Button>
      </form>
      {!passwordError && !nameError && (
        <p className={cn(size.type.caption, "pt-3 text-muted-foreground")}>
          Der Name steht an deinen Kommentaren. Dieser Browser merkt sich beides.
        </p>
      )}
    </CenteredCard>
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error && err.message ? err.message : "Das hat nicht geklappt. Bitte erneut versuchen.";
}
