"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NotificationLog } from "@/types";

interface RecentLogsProps {
  logs: NotificationLog[];
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-400/20",
  sent: "bg-sky-400/10 text-sky-700 dark:text-sky-300 border border-sky-400/20",
  delivered: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/20",
  failed: "bg-rose-400/10 text-rose-700 dark:text-rose-300 border border-rose-400/20",
  read: "bg-purple-400/10 text-purple-700 dark:text-purple-300 border border-purple-400/20",
};

const channelColors: Record<string, string> = {
  wa: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 border border-emerald-400/20",
  email: "bg-sky-400/10 text-sky-700 dark:text-sky-300 border border-sky-400/20",
};

export function RecentLogs({ logs }: RecentLogsProps) {
  const { t } = useI18n();

  return (
    <Card className="nf-card rounded-2xl shadow-xl shadow-black/20">
      <CardHeader>
        <CardTitle className="text-nf-on-surface">{t.dashboard.recentNotifications}</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-nf-on-surface-variant/70">
            {t.dashboard.noNotifications}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-label uppercase tracking-wider text-xs text-nf-on-surface-variant/70">{t.common.channel}</TableHead>
                  <TableHead className="font-label uppercase tracking-wider text-xs text-nf-on-surface-variant/70">{t.common.status}</TableHead>
                  <TableHead className="font-label uppercase tracking-wider text-xs text-nf-on-surface-variant/70">{t.common.priority}</TableHead>
                  <TableHead className="font-label uppercase tracking-wider text-xs text-nf-on-surface-variant/70">{t.common.content}</TableHead>
                  <TableHead className="font-label uppercase tracking-wider text-xs text-nf-on-surface-variant/70 text-right">{t.common.start}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <TableCell>
                      <Badge className={channelColors[log.channel] || ""}>
                        {log.channel === "wa" ? "WhatsApp" : "Email"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[log.status || "pending"] || ""}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-nf-on-surface-variant/80">{log.priority}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.content?.text || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-nf-on-surface-variant/70">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
