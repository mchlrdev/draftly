"use client";

import Link from "next/link";
import { Tabs, TabsList, TabItem } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSize } from "@/lib/size-context";
import { fontWeights } from "@/lib/font-weight";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/api-types";

// Top bar of the viewer (artboard Viewer / Viewer · Operator): project title
// and draft slug on the left, the page switcher centred, and for the
// operator a badge plus the way back to /admin.

export function ViewerToolbar({
  projectTitle,
  projectSlug,
  draftSlug,
  pages,
  pageId,
  onPageChange,
  operator,
}: {
  projectTitle: string;
  projectSlug: string;
  draftSlug: string;
  pages: Page[];
  pageId: string | null;
  onPageChange: (pageId: string) => void;
  operator: boolean;
}) {
  const size = useSize();
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
        {operator && (
          <>
            <Badge size="compact" color="gray">
              Operator
            </Badge>
            <Button
              variant="ghost"
              render={<Link href={`/admin/${encodeURIComponent(projectSlug)}/${encodeURIComponent(draftSlug)}`} />}
            >
              Zur Verwaltung
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
