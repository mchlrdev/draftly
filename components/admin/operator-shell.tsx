"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown"
import { MenuItem } from "@/components/ui/menu-item"
import { SidebarUserFooter } from "@/components/sidebar-app/user-footer"
import { BrandLabel } from "@/components/brand-label"
import { NewProjectDialog } from "@/components/admin/new-project-dialog"
import { NewDraftDialog } from "@/components/admin/new-draft-dialog"
import { DeleteProjectDialog } from "@/components/admin/delete-project"
import { DeleteDraftDialog } from "@/components/admin/delete-draft"
import {
  EditDraftDialog,
  EditProjectDialog,
} from "@/components/admin/edit-dialogs"
import { OperatorSettingsDialog } from "@/components/admin/settings-dialog"
import { AgentDialog } from "@/components/admin/agent-dialog"
import { TrashIcon } from "@/components/admin/icons"
import { useIcons } from "@/lib/icon-context"
import { operatorApi } from "@/lib/admin/api"
import { SIDEBAR_MENU_POPUP } from "@/lib/sidebar-menu-grid"
import { exitFallbackMs, spring } from "@/lib/springs"
import { openCommentsLabel } from "@/lib/admin/format"
import type { DraftSummary, Project } from "@/lib/api-types"
import { typeClass } from "@/lib/type-scale"
import { cn } from "@/lib/utils"

// The operator shell. The sidebar is the navigation: "Neues Projekt", then
// every project as a collapsible row holding its drafts and a "Neuer Draft"
// row. Each project and draft row carries a ⋯ menu (Bearbeiten, Löschen).
// The footer shows the operator's name and opens settings, agent access and
// sign-out. Rows carry the number of open threads, so new comments show
// without opening a draft; the data refreshes every minute and on return to
// the tab.
// Data comes from the server layout; mutations end in router.refresh().

type Dialog =
  | { kind: "new-project" }
  | { kind: "settings" }
  | { kind: "agents" }
  | { kind: "new-draft"; project: Project }
  | { kind: "edit-project"; project: Project }
  | { kind: "delete-project"; project: Project }
  | { kind: "edit-draft"; project: Project; draft: DraftSummary }
  | { kind: "delete-draft"; draft: DraftSummary }

type RouteParams = { project?: string; draft?: string }

export function OperatorShell({
  projects,
  operatorName,
  children,
}: {
  projects: Project[]
  operatorName: string | null
  children: ReactNode
}) {
  const router = useRouter()
  const params = useParams<RouteParams>()
  const icons = useIcons()

  // One dialog at a time. A fresh key per opening resets its fields; the
  // last kind stays mounted while it closes so the exit can play.
  const [dialog, setDialog] = useState<{
    key: number
    open: boolean
    which: Dialog | null
  }>({ key: 0, open: false, which: null })
  const show = (which: Dialog) =>
    setDialog((d) => ({ key: d.key + 1, open: true, which }))
  const setOpen = (open: boolean) => setDialog((d) => ({ ...d, open }))

  // A project's sub-list is open when toggled open, else when it holds the
  // current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (slug: string) => toggled[slug] ?? slug === params.project

  // Reviewers comment while the operator is elsewhere: refetch the layout's
  // data (counts included) on an interval and when the tab comes back.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = window.setInterval(refresh, REFRESH_MS)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [router])

  const logout = async () => {
    await operatorApi.logout()
    router.push("/admin")
    router.refresh()
  }

  const projectSlugs = projects.map((p) => p.slug)

  return (
    <SidebarProvider width="15rem" className="min-h-dvh">
      <Sidebar>
        <SidebarHeader className="px-5 pt-7 pb-5">
          <BrandLabel />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-3" aria-label="Aktionen">
            <SidebarMenuItem>
              <SidebarMenuButton
                icon={icons.plus}
                onClick={() => show({ kind: "new-project" })}
              >
                Projekt anlegen
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarGroup className="px-3 pt-4">
            <SidebarGroupLabel>Projekte</SidebarGroupLabel>
            {projects.length === 0 ? (
              <p
                className={cn(
                  typeClass("body", "compact"),
                  "px-2 py-1 text-muted-foreground"
                )}
              >
                Noch keine Projekte. Lege oben das erste an.
              </p>
            ) : (
              <SidebarMenu aria-label="Projekte">
                {projects.map((project) => {
                  const open = isOpen(project.slug)
                  const title = project.title || project.slug
                  return (
                    <SidebarMenuItem key={project.slug}>
                      <SidebarMenuButton
                        icon={icons.folder}
                        // Only the leaf row is lit: a lit project above a lit
                        // draft stacks two fills with different radii.
                        isActive={
                          params.project === project.slug && !params.draft
                        }
                        aria-expanded={open}
                        onClick={() =>
                          setToggled((t) => ({ ...t, [project.slug]: !open }))
                        }
                      >
                        {title}
                      </SidebarMenuButton>
                      {!open && (
                        <OpenCount
                          n={project.drafts.reduce(
                            (sum, d) => sum + d.openThreadCount,
                            0
                          )}
                        />
                      )}
                      <RowMenu
                        label={`Aktionen für ${title}`}
                        onEdit={() => show({ kind: "edit-project", project })}
                        onDelete={() =>
                          show({ kind: "delete-project", project })
                        }
                      />
                      <SidebarMenuSub open={open}>
                        {project.drafts.map((draft) => (
                          <SidebarMenuSubItem key={draft.slug}>
                            <SidebarMenuSubButton
                              isActive={
                                params.project === project.slug &&
                                params.draft === draft.slug
                              }
                              render={
                                <Link
                                  href={`/admin/${project.slug}/${draft.slug}`}
                                />
                              }
                            >
                              {draft.slug}
                            </SidebarMenuSubButton>
                            <OpenCount n={draft.openThreadCount} />
                            <RowMenu
                              label={`Aktionen für ${draft.slug}`}
                              onEdit={() =>
                                show({ kind: "edit-draft", project, draft })
                              }
                              onDelete={() =>
                                show({ kind: "delete-draft", draft })
                              }
                            />
                          </SidebarMenuSubItem>
                        ))}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            icon={icons.plus}
                            render={<button type="button" />}
                            onClick={() => show({ kind: "new-draft", project })}
                          >
                            Draft anlegen
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            )}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUserFooter
            className="px-1"
            name={operatorName ?? "Name festlegen"}
            avatar={<Initial name={operatorName} />}
            menu={
              <>
                <MenuItem
                  index={0}
                  icon={icons.settings}
                  label="Einstellungen"
                  onSelect={later(() => show({ kind: "settings" }))}
                />
                <MenuItem
                  index={1}
                  icon={icons.brain}
                  label="Agenten"
                  onSelect={later(() => show({ kind: "agents" }))}
                />
                <MenuItem
                  index={2}
                  icon={icons["arrow-left"]}
                  label="Abmelden"
                  onSelect={() => void logout()}
                />
              </>
            }
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex w-full flex-col gap-7 px-12 py-9">{children}</div>
      </SidebarInset>

      <ShellDialog
        key={dialog.key}
        which={dialog.which}
        open={dialog.open}
        onOpenChange={setOpen}
        projectSlugs={projectSlugs}
        operatorName={operatorName}
        params={params}
      />
    </SidebarProvider>
  )
}

const REFRESH_MS = 60_000

/** Open threads on the row's trailing badge axis; nothing when there are none. */
function OpenCount({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <SidebarMenuBadge
      title={openCommentsLabel(n)}
      className="rounded-full bg-primary text-primary-foreground"
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {openCommentsLabel(n)}</span>
    </SidebarMenuBadge>
  )
}

// A menu hands focus back to its trigger as it closes; opening a dialog
// after that exit lets the dialog's autofocus field keep focus.
const later = (fn: () => void) => () => {
  window.setTimeout(fn, exitFallbackMs(spring.fast))
}

/** The ⋯ menu on a sidebar row: shown on hover, focus, and while open. */
function RowMenu({
  label,
  onEdit,
  onDelete,
}: {
  label: string
  onEdit: () => void
  onDelete: () => void
}) {
  const icons = useIcons()
  const More = icons["more-horizontal"]
  return (
    <DropdownMenu>
      <DropdownTrigger
        render={
          <SidebarMenuAction showOnHover aria-label={label}>
            <More />
          </SidebarMenuAction>
        }
      />
      <DropdownContent
        className={cn(SIDEBAR_MENU_POPUP, "min-w-[180px]")}
        align="start"
        sideOffset={4}
      >
        <MenuItem
          index={0}
          icon={icons.pencil}
          label="Bearbeiten"
          onSelect={later(onEdit)}
        />
        <MenuItem
          index={1}
          icon={TrashIcon}
          label="Löschen"
          onSelect={later(onDelete)}
        />
      </DropdownContent>
    </DropdownMenu>
  )
}

/** 20px circle with the operator's initial (or a person glyph's stand-in). */
function Initial({ name }: { name: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        typeClass("micro", "compact"),
        "flex size-5 items-center justify-center rounded-full bg-muted-foreground text-background"
      )}
    >
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  )
}

function ShellDialog({
  which,
  open,
  onOpenChange,
  projectSlugs,
  operatorName,
  params,
}: {
  which: Dialog | null
  open: boolean
  onOpenChange: (open: boolean) => void
  projectSlugs: string[]
  operatorName: string | null
  params: RouteParams
}) {
  if (!which) return null
  const common = { open, onOpenChange }
  switch (which.kind) {
    case "new-project":
      return <NewProjectDialog {...common} takenSlugs={projectSlugs} />
    case "settings":
      return <OperatorSettingsDialog {...common} operatorName={operatorName} />
    case "agents":
      return <AgentDialog {...common} />
    case "new-draft":
      return (
        <NewDraftDialog
          {...common}
          projectSlug={which.project.slug}
          takenSlugs={which.project.drafts.map((d) => d.slug)}
        />
      )
    case "edit-project":
      return (
        <EditProjectDialog
          {...common}
          project={which.project}
          takenSlugs={projectSlugs}
        />
      )
    case "delete-project":
      return (
        <DeleteProjectDialog
          {...common}
          target={{
            slug: which.project.slug,
            title: which.project.title || which.project.slug,
            draftCount: which.project.drafts.length,
          }}
          leaveTo={params.project === which.project.slug ? "/admin" : undefined}
        />
      )
    case "edit-draft":
      return (
        <EditDraftDialog
          {...common}
          draft={which.draft}
          takenSlugs={which.project.drafts.map((d) => d.slug)}
        />
      )
    case "delete-draft":
      return (
        <DeleteDraftDialog
          {...common}
          draft={which.draft}
          leaveTo={
            params.project === which.draft.projectSlug &&
            params.draft === which.draft.slug
              ? `/admin/${which.draft.projectSlug}`
              : undefined
          }
        />
      )
  }
}
