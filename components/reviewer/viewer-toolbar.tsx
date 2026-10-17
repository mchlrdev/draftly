"use client"

import Link from "next/link"
import { Minus } from "@untitledui/icons"
import { Tabs, TabsList, TabItem } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useSize } from "@/lib/size-context"
import { useIcons, type IconComponentProps } from "@/lib/icon-context"
import { fontWeights } from "@/lib/font-weight"
import { cn } from "@/lib/utils"
import type { Page } from "@/lib/api-types"
import { ZOOM_STEPS, stepZoom, type Zoom } from "@/lib/reviewer/geometry"
import { SIDEBAR_ID } from "@/components/reviewer/sidebar-panel"

// The icon map has no minus slot; this adapter draws the same Untitled UI
// set the app's IconProvider uses.
function MinusIcon({ size, strokeWidth, className }: IconComponentProps) {
  return (
    <Minus
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  )
}

// Top bar of the viewer (artboard Viewer / Viewer · Operator): project title
// and draft slug on the left, the page switcher centred, and for the
// operator a badge plus the way back to /admin. On the right: the zoom of a
// fixed page and the comments sidebar toggle.

export function ViewerToolbar({
  projectTitle,
  projectSlug,
  draftSlug,
  pages,
  pageId,
  onPageChange,
  operator,
  zoom,
  shownScale,
  zoomEnabled,
  onZoomChange,
  sidebarOpen,
  onToggleSidebar,
}: {
  projectTitle: string
  projectSlug: string
  draftSlug: string
  pages: Page[]
  pageId: string | null
  onPageChange: (pageId: string) => void
  operator: boolean
  zoom: Zoom
  /** The scale the page is shown at right now (fit or explicit). */
  shownScale: number
  /** False for fill pages: they are never zoomed. */
  zoomEnabled: boolean
  onZoomChange: (zoom: Zoom) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  const size = useSize()
  const icons = useIcons()
  const PanelIcon = icons["panel-right"]
  return (
    <header className="grid h-13 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border bg-background px-5">
      <div className="flex min-w-0 items-center gap-5">
        <span
          className={cn(size.type.body, "truncate text-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {projectTitle}
        </span>
        <span
          className={cn(size.type.body, "shrink-0 text-muted-foreground")}
          style={{ fontVariationSettings: fontWeights.semibold }}
        >
          {draftSlug}
        </span>
      </div>

      <nav aria-label="Seiten" className="min-w-0">
        {pages.length > 0 && pageId && (
          <Tabs value={pageId} onValueChange={onPageChange}>
            <TabsList>
              {pages.map((p) => (
                <TabItem key={p.id} value={p.id} label={p.name} />
              ))}
            </TabsList>
          </Tabs>
        )}
      </nav>

      <div className="flex min-w-0 items-center justify-end gap-2">
        <ZoomControl
          zoom={zoom}
          shownScale={shownScale}
          enabled={zoomEnabled}
          onZoomChange={onZoomChange}
        />
        <Tooltip
          content={
            sidebarOpen
              ? "Kommentare ausblenden (C)"
              : "Kommentare einblenden (C)"
          }
          side="bottom"
        >
          <Button
            variant="ghost"
            size="icon-compact"
            aria-label="Kommentare"
            aria-pressed={sidebarOpen}
            aria-controls={SIDEBAR_ID}
            aria-keyshortcuts="C"
            active={sidebarOpen}
            onClick={onToggleSidebar}
          >
            <PanelIcon size={14} strokeWidth={1.5} />
          </Button>
        </Tooltip>
        {operator && (
          <>
            <Badge size="compact" color="gray">
              Operator
            </Badge>
            <Button
              variant="ghost"
              render={
                <Link
                  href={`/admin/${encodeURIComponent(projectSlug)}/${encodeURIComponent(draftSlug)}`}
                />
              }
            >
              Zur Verwaltung
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

function ZoomControl({
  zoom,
  shownScale,
  enabled,
  onZoomChange,
}: {
  zoom: Zoom
  shownScale: number
  enabled: boolean
  onZoomChange: (zoom: Zoom) => void
}) {
  const icons = useIcons()
  const PlusIcon = icons.plus
  const value = zoom === "fit" ? "fit" : String(zoom)
  const canZoomOut = enabled && shownScale > ZOOM_STEPS[0] + 0.001
  const canZoomIn = enabled && shownScale < 1 - 0.001
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="flex items-center gap-0.5"
      aria-disabled={!enabled || undefined}
    >
      <Tooltip content="Verkleinern (−)" side="bottom">
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="Verkleinern"
          aria-keyshortcuts="-"
          disabled={!canZoomOut}
          onClick={() => onZoomChange(stepZoom(shownScale, -1))}
        >
          <MinusIcon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Select
        value={value}
        disabled={!enabled}
        onValueChange={(v) => onZoomChange(v === "fit" ? "fit" : Number(v))}
      >
        <SelectTrigger
          variant="borderless"
          aria-label="Zoom"
          className="min-w-[112px]"
        />
        <SelectContent>
          <SelectItem index={0} value="fit">
            Einpassen
          </SelectItem>
          {ZOOM_STEPS.map((step, i) => (
            <SelectItem key={step} index={i + 1} value={String(step)}>
              {`${Math.round(step * 100)} %`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip content="Vergrößern (+)" side="bottom">
        <Button
          variant="ghost"
          size="icon-compact"
          aria-label="Vergrößern"
          aria-keyshortcuts="+"
          disabled={!canZoomIn}
          onClick={() => onZoomChange(stepZoom(shownScale, 1))}
        >
          <PlusIcon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </div>
  )
}
