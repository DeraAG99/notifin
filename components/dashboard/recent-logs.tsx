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
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  read: "bg-purple-100 text-purple-800",
};

const channelColors: Record<string, string> = {
  wa: "bg-emerald-100 text-emerald-800",
  email: "bg-blue-100 text-blue-800",
};

export function RecentLogs({ logs }: RecentLogsProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.dashboard.recentNotifications}</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {t.dashboard.noNotifications}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.channel}</TableHead>
                  <TableHead>{t.common.status}</TableHead>
                  <TableHead>{t.common.priority}</TableHead>
                  <TableHead>{t.common.content}</TableHead>
                  <TableHead className="text-right">{t.common.start}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
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
                      <Badge variant="outline">{log.priority}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.content?.text || "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
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
