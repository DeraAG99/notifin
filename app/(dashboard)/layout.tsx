"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/sidebar";
import { Header } from "@/components/layouts/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-nf-bg text-nf-on-surface font-display">
      <div className="ambient-orb orb-1 animate-pulse fixed" />
      <div className="ambient-orb orb-2 fixed" />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 dashboard-bg">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
