"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DraftSnapshot, ThreadStatus } from "@/lib/api-types";
import { numberedThreads, openCount, useDraftState } from "@/hooks/use-draft-state";
import { useDraftEvents } from "@/hooks/use-draft-events";
import { useIdentity } from "@/lib/reviewer/identity";
import { useSize } from "@/lib/size-context";
import { cn } from "@/lib/utils";
import type { Point } from "@/lib/reviewer/geometry";
import { ViewerProvider, type ViewerContextValue } from "@/components/reviewer/viewer-context";
import { ViewerToolbar } from "@/components/reviewer/viewer-toolbar";
import { CommentsSidebar } from "@/components/reviewer/comments-sidebar";
import { PageStage } from "@/components/reviewer/page-stage";

// The reviewer's viewer: toolbar, page stage, comments sidebar. Comment data
// lives in one reducer (hooks/use-draft-state) fed by the server snapshot,
// our own writes and the live event stream.

export function Viewer({
  project,
  draft,
  initialSnapshot,
  initialPageId,
}: {
  project: string;
  draft: string;
  initialSnapshot: DraftSnapshot;
  initialPageId?: string;
}) {
  const router = useRouter();
  const size = useSize();
  const [state, dispatch] = useDraftState(initialSnapshot);
  const identity = useIdentity();
  const draftRef = useMemo(() => ({ project, draft }), [project, draft]);

  useDraftEvents(draftRef, dispatch, () => router.refresh());

  const pages = state.draft.pages;
  const [chosenPageId, setChosenPageId] = useState<string | undefined>(initialPageId);
  const page = pages.find((p) => p.id === chosenPageId) ?? pages[0] ?? null;

  const [filter, setFilter] = useState<ThreadStatus>("open");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [composer, setComposer] = useState<Point | null>(null);
  const composerHasText = useRef(false);

  const numbered = useMemo(() => (page ? numberedThreads(state, page.id) : []), [state, page]);
  const rows = numbered.filter((n) => n.thread.status === filter);
  const openThread = numbered.find((n) => n.thread.id === openThreadId) ?? null;
  const pins = numbered.filter((n) => n.thread.status === filter || n.thread.id === openThreadId);

  const authorName = identity?.name || (state.operator ? "Operator" : "");
  const viewerContext = useMemo<ViewerContextValue>(
    () => ({ draftRef, dispatch, operator: state.operator, clientId: identity?.clientId ?? null, authorName }),
    [draftRef, dispatch, state.operator, identity?.clientId, authorName],
  );

  const closeComposer = useCallback(() => {
    composerHasText.current = false;
    setComposer(null);
  }, []);

  const changePage = useCallback(
    (id: string) => {
      setChosenPageId(id);
      setOpenThreadId(null);
      closeComposer();
      const url = new URL(window.location.href);
      url.searchParams.set("page", id);
      window.history.replaceState(null, "", url);
    },
    [closeComposer],
  );

  function place(point: Point) {
    // A click beside an open popover only closes it.
    if (openThreadId) {
      setOpenThreadId(null);
      return;
    }
    // A started comment is never thrown away by a stray click.
    if (composer && composerHasText.current) return;
    setFilter("open");
    setComposer(point);
  }

  function openThreadById(id: string) {
    if (composer && composerHasText.current) return;
    closeComposer();
    setOpenThreadId(id);
  }

  // Esc closes the composer or the open thread. Menus and dialogs inside
  // handle their own Esc first and mark it handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (composer) closeComposer();
      else if (openThreadId) setOpenThreadId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composer, openThreadId, closeComposer]);

  return (
    <ViewerProvider value={viewerContext}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <ViewerToolbar
          projectTitle={state.draft.projectTitle}
          projectSlug={state.draft.projectSlug}
          draftSlug={state.draft.slug}
          pages={pages}
          pageId={page?.id ?? null}
          onPageChange={changePage}
          operator={state.operator}
        />
        <div className="flex min-h-0 flex-1">
          {page ? (
            <PageStage
              page={page}
              letterbox={state.draft.letterbox}
              pins={pins}
              openThread={openThread}
              composer={composer}
              onPlace={place}
              onOpenThread={openThreadById}
              onCloseThread={() => setOpenThreadId(null)}
              onComposerDone={() => closeComposer()}
              onComposerCancel={closeComposer}
              onComposerDraftChange={(hasText) => {
                composerHasText.current = hasText;
              }}
            />
          ) : (
            <div
              className="flex min-w-0 flex-1 items-center justify-center p-8"
              style={{ backgroundColor: state.draft.letterbox }}
            >
              <p className={cn(size.type.subtitle, "text-muted-foreground")}>
                Dieser Entwurf hat noch keine Seiten.
              </p>
            </div>
          )}
          <CommentsSidebar
            rows={rows}
            openCount={page ? openCount(state, page.id) : 0}
            pageHasThreads={numbered.length > 0}
            filter={filter}
            onFilterChange={(f) => {
              setFilter(f);
              if (openThread && openThread.thread.status !== f) setOpenThreadId(null);
            }}
            selectedId={openThreadId}
            onSelect={(id) => (openThreadId === id ? setOpenThreadId(null) : openThreadById(id))}
            composing={composer !== null}
          />
        </div>
      </div>
    </ViewerProvider>
  );
}
