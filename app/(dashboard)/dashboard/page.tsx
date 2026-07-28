"use client";

import { useEffect, useState } from "react";
import { StatCards } from "@/components/dashboard/stat-cards";
import { NotificationChart } from "@/components/dashboard/notification-chart";
import { RecentLogs } from "@/components/dashboard/recent-logs";
import { QueueHealth } from "@/components/dashboard/queue-health";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import type { DashboardStats, NotificationLog } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [queueStats, setQueueStats] = useState<{
    whatsapp: { waiting: number; active: number; completed: number; failed: number; delayed: number };
    email: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, logsRes, queueRes] = await Promise.all([
          fetch("/api/logs/stats"),
          fetch("/api/logs?pageSize=10"),
          fetch("/api/queue/stats"),
        ]);

        const statsData = await statsRes.json();
        const logsData = await logsRes.json();
        const queueData = await queueRes.json();

        if (statsData.success) setStats(statsData.data);
        if (logsData.success) setLogs(logsData.data.items);
        if (queueData.success) setQueueStats(queueData.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your notification system
        </p>
      </div>

      {stats && <StatCards stats={stats} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NotificationChart data={stats?.charts || []} />
        </div>
        <div>
          {queueStats && <QueueHealth stats={queueStats} />}
        </div>
      </div>

      <RecentLogs logs={logs} />
    </div>
  );
}
