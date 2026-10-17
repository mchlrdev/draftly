"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { DraftSnapshot, ThreadStatus } from "@/lib/api-types"
import {
  numberedThreads,
  openCount,
  useDraftState,
} from "@/hooks/use-draft-state"
import { useDraftEvents } from "@/hooks/use-draft-events"
import { useDraftSidebar } from "@/hooks/use-draft-sidebar"
import { useAuthorKey, useIdentity } from "@/lib/reviewer/identity"
import { useSize } from "@/lib/size-context"
import { cn } from "@/lib/utils"
import { stepZoom, type Point, type Zoom } from "@/lib/reviewer/geometry"
import {
  ViewerProvider,
  type ViewerContextValue,
} from "@/components/reviewer/viewer-context"
import { ViewerToolbar } from "@/components/reviewer/viewer-toolbar"
import { CommentsSidebar } from "@/components/reviewer/comments-sidebar"
import { PageStage } from "@/components/reviewer/page-stage"
import { SidebarPanel } from "@/components/reviewer/sidebar-panel"

// The reviewer's viewer: toolbar, page stage, comments sidebar. Comment data
// lives in one reducer (hooks/use-draft-state) fed by the server snapshot,
// our own writes and the live event stream.

export function Viewer({
  project,
  draft,
  initialSnapshot,
  initialPageId,
}: {
  project: string
  draft: string
  initialSnapshot: DraftSnapshot
  initialPageId?: string
}) {
  const router = useRouter()
  const size = useSize()
  const [state, dispatch] = useDraftState(initialSnapshot)
  const identity = useIdentity()
  const draftRef = useMemo(() => ({ project, draft }), [project, draft])

  useDraftEvents(draftRef, dispatch, () => router.refresh())

  const pages = state.draft.pages
  const [chosenPageId, setChosenPageId] = useState<string | undefined>(
    initialPageId
  )
  const page = pages.find((p) => p.id === chosenPageId) ?? pages[0] ?? null

  const [filter, setFilter] = useState<ThreadStatus>("open")
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)
  const [composer, setComposer] = useState<Point | null>(null)
  const composerHasText = useRef(false)

  const numbered = useMemo(
    () => (page ? numberedThreads(state, page.id) : []),
    [state, page]
  )
  const rows = numbered.filter((n) => n.thread.status === filter)
  const openThread = numbered.find((n) => n.thread.id === openThreadId) ?? null
  const pins = numbered.filter(
    (n) => n.thread.status === filter || n.thread.id === openThreadId
  )

  const sidebar = useDraftSidebar()
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [shownScale, setShownScale] = useState(1)
  const zoomEnabled = page?.display === "fixed"

  const clientId = identity?.clientId ?? null
  const authorKey = useAuthorKey(clientId)
  // The operator comments under the name set in /admin, never under a name
  // this browser once typed at a reviewer's password gate.
  const authorName = state.operator
    ? state.operatorName?.trim() || "Operator"
    : (identity?.name ?? "")
  const viewerContext = useMemo<ViewerContextValue>(
    () => ({
      draftRef,
      dispatch,
      operator: state.operator,
      clientId,
      authorKey,
      authorName,
    }),
    [draftRef, dispatch, state.operator, clientId, authorKey, authorName]
  )

  const closeComposer = useCallback(() => {
    composerHasText.current = false
    setComposer(null)
  }, [])

  const changePage = useCallback(
    (id: string) => {
      setChosenPageId(id)
      setOpenThreadId(null)
      closeComposer()
      const url = new URL(window.location.href)
      url.searchParams.set("page", id)
      window.history.replaceState(null, "", url)
    },
    [closeComposer]
  )

  function place(point: Point) {
    // A click beside an open popover only closes it.
    if (openThreadId) {
      setOpenThreadId(null)
      return
    }
    // A started comment is never thrown away by a stray click.
    if (composer && composerHasText.current) return
    setFilter("open")
    setComposer(point)
  }

  function openThreadById(id: string) {
    if (composer && composerHasText.current) return
    closeComposer()
    setOpenThreadId(id)
  }

  // Esc closes the composer or the open thread. Menus and dialogs inside
  // handle their own Esc first and mark it handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (composer) closeComposer()
      else if (openThreadId) setOpenThreadId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [composer, openThreadId, closeComposer])

  // Single-key shortcuts, only while focus is outside text fields and with
  // no modifier, so Cmd/Ctrl +/−/0 stay the browser's own zoom.
  // C toggles the comments; + / − step the zoom of a fixed page; 0 fits it.
  const { toggle: toggleSidebar } = sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.isComposing || isTypingTarget(e.target)) return
      if (e.key === "c" || e.key === "C") {
        e.preventDefault()
        toggleSidebar()
        return
      }
      if (!zoomEnabled) return
      if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        setZoom(stepZoom(shownScale, 1))
      } else if (e.key === "-" || e.key === "−") {
        e.preventDefault()
        setZoom(stepZoom(shownScale, -1))
      } else if (e.key === "0") {
        e.preventDefault()
        setZoom("fit")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleSidebar, zoomEnabled, shownScale])

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
          zoom={zoom}
          shownScale={shownScale}
          zoomEnabled={zoomEnabled}
          onZoomChange={setZoom}
          sidebarOpen={sidebar.open}
          onToggleSidebar={sidebar.toggle}
        />
        <div className="flex min-h-0 flex-1">
          {page ? (
            <PageStage
              page={page}
              letterbox={state.draft.letterbox}
              zoom={zoom}
              onScaleChange={setShownScale}
              pins={pins}
              openThread={openThread}
              composer={composer}
              onPlace={place}
              onOpenThread={openThreadById}
              onCloseThread={() => setOpenThreadId(null)}
              onComposerDone={() => closeComposer()}
              onComposerCancel={closeComposer}
              onComposerDraftChange={(hasText) => {
                composerHasText.current = hasText
              }}
            />
          ) : (
            <div className="flex min-w-0 flex-1 py-2 pl-2">
              <div
                className="flex min-w-0 flex-1 items-center justify-center rounded-[12px] p-8 shadow-[inset_0_0_0_1px_var(--border)]"
                style={{ backgroundColor: state.draft.letterbox }}
              >
                <p className={cn(size.type.subtitle, "text-muted-foreground")}>
                  Dieser Entwurf hat noch keine Seiten.
                </p>
              </div>
            </div>
          )}
          <SidebarPanel
            open={sidebar.open}
            width={sidebar.width}
            onWidthChange={sidebar.setWidth}
          >
            <CommentsSidebar
              rows={rows}
              openCount={page ? openCount(state, page.id) : 0}
              pageHasThreads={numbered.length > 0}
              filter={filter}
              onFilterChange={(f) => {
                setFilter(f)
                if (openThread && openThread.thread.status !== f)
                  setOpenThreadId(null)
              }}
              selectedId={openThreadId}
              onSelect={(id) =>
                openThreadId === id ? setOpenThreadId(null) : openThreadById(id)
              }
              composing={composer !== null}
            />
          </SidebarPanel>
        </div>
      </div>
    </ViewerProvider>
  )
}

/** Text fields, editable regions and open menus keep their own keys. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type
    return ![
      "button",
      "checkbox",
      "radio",
      "range",
      "submit",
      "reset",
    ].includes(type)
  }
  return !!target.closest('[role="menu"], [role="listbox"], [role="combobox"]')
}
