"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Clock,
  ScrollText,
  Settings,
  Bell,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dasbor", icon: LayoutDashboard },
  { href: "/templates", label: "Template", icon: FileText },
  { href: "/users", label: "Pengguna", icon: Users },
  { href: "/schedules", label: "Jadwal", icon: Clock },
  { href: "/logs", label: "Log", icon: ScrollText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Bell className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold">Notifin</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t text-xs text-muted-foreground">
        Notifin v0.1.0
      </div>
    </aside>
  );
}
