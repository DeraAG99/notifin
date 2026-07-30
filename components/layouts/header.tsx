"use client";

import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "@/components/layouts/language-switcher";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const pageTitles: Record<string, string> = {
  dashboard: "dashboard.title",
  templates: "templates.title",
  users: "users.title",
  schedules: "schedules.title",
  logs: "logs.title",
  settings: "settings.title",
};

function getPageTitle(pathname: string | null, t: ReturnType<typeof useI18n>["t"]): string {
  if (!pathname) return t.dashboard.title;
  const segment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  const key = pageTitles[segment];
  if (!key) return t.dashboard.title;
  const val = key.split(".").reduce<Record<string, unknown>>((obj, k) => (obj?.[k] ?? {}) as Record<string, unknown>, t as unknown as Record<string, unknown>);
  return typeof val === "string" ? val : segment;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { user, logout } = useAuth();

  const pageTitle = getPageTitle(pathname, t);
  const dateLang = locale === "id" ? "id-ID" : "en-US";

  return (
    <header className="flex items-center h-14 shrink-0 border-b px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1 size-8" />
        <span className="text-sm font-medium text-muted-foreground select-none">
          {pageTitle}
        </span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-xs text-muted-foreground hidden md:block">
          {new Date().toLocaleDateString(dateLang, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        <LanguageSwitcher />
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="gap-2"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{user.name}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
