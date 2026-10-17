"use client";

import { useState, type KeyboardEvent } from "react";
import { Trash01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownTrigger, DropdownContent } from "@/components/ui/dropdown";
import { MenuItem } from "@/components/ui/menu-item";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIcons } from "@/lib/icon-context";
import { useSize } from "@/lib/size-context";
import { fontWeights } from "@/lib/font-weight";
import { cn } from "@/lib/utils";
import { MAX_COMMENT_LENGTH, type Comment, type Thread } from "@/lib/api-types";
import { reviewerApi } from "@/lib/reviewer/api";
import { relativeTime, useNow } from "@/lib/reviewer/time";
import type { PopoverPlacement } from "@/lib/reviewer/geometry";
import { FramedInput, FramedTextarea } from "@/components/reviewer/fields";
import { PinNumber } from "@/components/reviewer/pin-badge";
import { PopoverShell } from "@/components/reviewer/popover-shell";
import { useViewer } from "@/components/reviewer/viewer-context";

// Artboards "Viewer · Thread", "Thread mit Antworten", "Kommentar bearbeiten"
// and "Viewer · Operator". Comment bodies are plain text, rendered as text.

export const DELETED_TEXT = "Kommentar gelöscht.";

export function ThreadPopover({
  thread,
  number,
  placement,
  onClose,
}: {
  thread: Thread;
  number: number;
  placement: PopoverPlacement;
  onClose: () => void;
}) {
  const { draftRef, dispatch, operator, clientId, authorName } = useViewer();
  const size = useSize();
  const icons = useIcons();
  const now = useNow();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<null | "reply" | "status" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();

  const [first, ...replies] = thread.comments;
  const hasReplies = replies.length > 0;
  const resolved = thread.status === "resolved";

  async function run<T>(kind: NonNullable<typeof busy> | null, task: () => Promise<T>) {
    if (kind) setBusy(kind);
    setError(undefined);
    try {
      return await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      if (kind) setBusy(null);
    }
  }

  async function sendReply() {
    const body = reply.trim();
    if (!body || !clientId || !authorName || busy) return;
    const comment = await run("reply", () =>
      reviewerApi.createComment(draftRef, thread.id, { body, authorName, clientId }),
    );
    if (comment) {
      dispatch({ type: "event", event: { type: "comment.created", comment } });
      setReply("");
    }
  }

  async function setStatus(status: Thread["status"]) {
    const next = await run("status", () => reviewerApi.setThreadStatus(draftRef, thread.id, status));
    if (next) dispatch({ type: "event", event: { type: "thread.updated", thread: next } });
  }

  async function deleteThread() {
    const ok = await run("delete", async () => {
      await reviewerApi.deleteThread(draftRef, thread.id);
      return true;
    });
    if (ok) {
      setConfirmDelete(false);
      dispatch({ type: "event", event: { type: "thread.deleted", threadId: thread.id, pageId: thread.pageId } });
      onClose();
    }
  }

  async function saveEdit(comment: Comment, body: string) {
    if (!clientId) return false;
    const next = await run(null, () => reviewerApi.updateComment(draftRef, comment.id, { body, clientId }));
    if (!next) return false;
    dispatch({ type: "event", event: { type: "comment.updated", comment: next } });
    setEditingId(null);
    return true;
  }

  async function deleteComment(comment: Comment) {
    const next = await run(null, () => reviewerApi.deleteComment(draftRef, comment.id, clientId ?? ""));
    if (next) dispatch({ type: "event", event: { type: "comment.deleted", comment: next } });
  }

  function onReplyKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendReply();
    }
  }

  const mine = (c: Comment) => !!clientId && c.clientId === clientId;
  const actionsFor = (c: Comment) => ({
    canEdit: !c.deletedAt && mine(c),
    canDelete: !c.deletedAt && (mine(c) || operator),
  });

  const time = (c: Comment) => {
    if (now === null) return "";
    if (c.deletedAt) return "";
    return c.editedAt ? `bearbeitet · ${relativeTime(c.editedAt, now)}` : relativeTime(c.createdAt, now);
  };

  // The operator's trash in the header already removes the whole thread, so
  // the first comment only gets a menu when it is the operator's own.
  const firstActions =
    first && (!operator || mine(first)) ? actionsFor(first) : { canEdit: false, canDelete: false };

  return (
    <PopoverShell placement={placement} label={`Kommentar ${number}`} className="gap-3">
      {/* Header: pin number, author, then time or the operator's controls */}
      <div className="flex items-center gap-2.5">
        <PinNumber number={number} resolved={resolved} />
        <span
          className={cn(size.type.body, "min-w-0 grow truncate text-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {first?.authorName ?? "Kommentar"}
        </span>
        {operator ? (
          <div className="flex shrink-0 items-center gap-1">
            {resolved ? (
              <Button
                variant="secondary"
                leadingIcon={icons["rotate-ccw"]}
                loading={busy === "status"}
                onClick={() => void setStatus("open")}
              >
                Wieder öffnen
              </Button>
            ) : (
              <Button
                variant="primary"
                leadingIcon={icons.check}
                loading={busy === "status"}
                onClick={() => void setStatus("resolved")}
              >
                Erledigen
              </Button>
            )}
            <Tooltip content="Thread löschen">
              <Button
                variant="ghost"
                size="icon-compact"
                aria-label="Thread löschen"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash01 />
              </Button>
            </Tooltip>
          </div>
        ) : (
          <>
            {resolved && (
              <Badge size="compact" color="gray">
                Erledigt
              </Badge>
            )}
            {hasReplies && first && (
              <span className={cn(size.type.caption, "shrink-0 text-muted-foreground")}>{time(first)}</span>
            )}
          </>
        )}
        {first && (firstActions.canEdit || firstActions.canDelete) && editingId !== first.id && (
          <CommentMenu
            {...firstActions}
            onEdit={() => setEditingId(first.id)}
            onDelete={() => void deleteComment(first)}
          />
        )}
      </div>

      <ScrollArea viewportClassName="max-h-[min(50vh,360px)]" className="-mx-4">
        <div className="flex flex-col gap-3 px-4">
          {first && (
            <div className={cn(hasReplies && "pl-9.5")}>
              {editingId === first.id ? (
                <CommentEditor
                  initial={first.body}
                  onCancel={() => setEditingId(null)}
                  onSave={(body) => saveEdit(first, body)}
                />
              ) : (
                <CommentBody comment={first} />
              )}
            </div>
          )}

          {replies.map((c) => {
            const { canEdit, canDelete } = actionsFor(c);
            return (
              <div key={c.id} className="flex flex-col gap-1.5 border-t border-border pt-3 pb-0.5 pl-9.5">
                <div className="flex min-h-6 items-center gap-2">
                  <span
                    className={cn(size.type.body, "min-w-0 truncate text-foreground")}
                    style={{ fontVariationSettings: fontWeights.semibold }}
                  >
                    {c.authorName}
                  </span>
                  <span className={cn(size.type.caption, "min-w-0 grow truncate text-muted-foreground")}>
                    {time(c)}
                  </span>
                  {(canEdit || canDelete) && editingId !== c.id && (
                    <CommentMenu
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={() => setEditingId(c.id)}
                      onDelete={() => void deleteComment(c)}
                    />
                  )}
                </div>
                {editingId === c.id ? (
                  <CommentEditor
                    initial={c.body}
                    onCancel={() => setEditingId(null)}
                    onSave={(body) => saveEdit(c, body)}
                  />
                ) : (
                  <CommentBody comment={c} />
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {error && (
        <p role="alert" className={cn(size.type.caption, "text-destructive")}>
          {error}
        </p>
      )}

      {!editingId && authorName && (
        <FramedInput
          aria-label={`Antworten als ${authorName}`}
          placeholder="Antworten…"
          value={reply}
          maxLength={MAX_COMMENT_LENGTH}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={onReplyKey}
          disabled={busy === "reply"}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Thread löschen?</DialogTitle>
            <DialogDescription>
              Der Pin und alle Kommentare darin verschwinden für alle. Das lässt sich nicht rückgängig machen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" loading={busy === "delete"} onClick={() => void deleteThread()}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PopoverShell>
  );
}

function CommentBody({ comment }: { comment: Comment }) {
  const size = useSize();
  if (comment.deletedAt) {
    return <p className={cn(size.type.subtitle, "text-muted-foreground")}>{DELETED_TEXT}</p>;
  }
  return (
    <p className={cn(size.type.subtitle, "whitespace-pre-wrap break-words text-foreground")}>{comment.body}</p>
  );
}

function CommentMenu({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const icons = useIcons();
  const More = icons["more-horizontal"];
  const items = [
    canEdit && { label: "Bearbeiten", onSelect: onEdit, destructive: false },
    canDelete && { label: "Löschen", onSelect: onDelete, destructive: true },
  ].filter(Boolean) as { label: string; onSelect: () => void; destructive: boolean }[];
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <Button variant="ghost" size="icon-compact" aria-label="Kommentar-Aktionen" className="shrink-0">
            <More />
          </Button>
        }
      />
      <DropdownContent align="end" className="w-38">
        {items.map((item, i) => (
          <MenuItem
            key={item.label}
            index={i}
            label={item.label}
            onSelect={item.onSelect}
            // The label paints its own color; Paper wants Löschen in red.
            className={item.destructive ? "[&_span]:text-destructive" : undefined}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

function CommentEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState(initial);
  const [pending, setPending] = useState(false);
  const trimmed = body.trim();
  const unchanged = trimmed === initial.trim();

  async function save() {
    if (!trimmed || pending) return;
    if (unchanged) return onCancel();
    setPending(true);
    const ok = await onSave(trimmed);
    if (!ok) setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <FramedTextarea
        autoFocus
        aria-label="Kommentar bearbeiten"
        className="min-h-16"
        value={body}
        maxLength={MAX_COMMENT_LENGTH}
        disabled={pending}
        onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-1">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Abbrechen
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={!trimmed} loading={pending}>
          Speichern
        </Button>
      </div>
    </div>
  );
}
