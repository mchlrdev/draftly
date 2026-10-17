"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useIcons } from "@/lib/icon-context"
import { operatorApi } from "@/lib/admin/api"
import { BrandLabel } from "@/components/admin/brand-label"

// The operator shell: a 240px sidebar with the one destination (Projekte)
// and a sign-out row, and the page in the inset beside it.

export function OperatorShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const icons = useIcons()

  const logout = async () => {
    await operatorApi.logout()
    router.push("/admin")
    router.refresh()
  }

  return (
    <SidebarProvider width="15rem" className="min-h-dvh">
      <Sidebar>
        <SidebarHeader className="px-5 pt-7 pb-5">
          <BrandLabel />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-3">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive
                icon={icons.folder}
                render={<Link href="/admin" />}
              >
                Projekte
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu className="px-1">
            <SidebarMenuItem>
              <SidebarMenuButton icon={icons["arrow-left"]} onClick={logout}>
                Abmelden
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex w-full flex-col gap-7 px-12 py-9">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
