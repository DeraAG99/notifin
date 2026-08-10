"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Users,
  Clock,
  ScrollText,
  Settings,
  LogOut,
  Building2,
  Boxes,
} from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { user, logout } = useAuth();

  const mainNav = [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/templates", label: t.nav.templates, icon: FileText },
    { href: "/users", label: t.nav.users, icon: Users },
  ];

  const systemNav = [
    ...(user?.role === "superadmin"
      ? [{ href: "/admins", label: t.nav.admins, icon: Building2 }]
      : []),
    { href: "/import-types", label: t.nav.importTypes, icon: Boxes },
    { href: "/schedules", label: t.nav.schedules, icon: Clock },
    { href: "/logs", label: t.nav.logs, icon: ScrollText },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];

  return (
    <Sidebar className="bg-sidebar/90 backdrop-blur-xl border-r border-sidebar-border">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl overflow-hidden border border-sidebar-border bg-muted">
                <img
                  src="/icon.svg"
                  alt="NOTIFIN"
                  className="size-full object-contain"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-display text-base font-bold tracking-tight">
                  Notifin
                </span>
                <span className="truncate text-xs text-nf-on-surface-variant/70">
                  Notification System
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-label uppercase tracking-wider text-xs">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.href ||
                      pathname?.startsWith(item.href + "/")
                    }
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="font-label uppercase tracking-wider text-xs">
            Sistem
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      pathname === item.href ||
                      pathname?.startsWith(item.href + "/")
                    }
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          {user && (
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              <LogOut className="size-4" />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Notifin v0.1.0
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
