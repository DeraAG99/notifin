"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, RefreshCw, Eye } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { NotificationLog, PaginatedResponse } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  read: "bg-purple-100 text-purple-800",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (channelFilter) params.set("channel", channelFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    try {
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.items);
        setPagination({
          page: data.data.page,
          totalPages: data.data.totalPages,
          total: data.data.total,
        });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [channelFilter, statusFilter, startDate, endDate]);

  const handleRetry = async (logId: string) => {
    try {
      const log = logs.find((l) => l.id === logId);
      if (!log) return;
      await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: log.templateId,
          userId: log.userId,
          channel: log.channel,
          priority: log.priority,
        }),
      });
      fetchLogs(pagination.page);
    } catch (error) {
      console.error("Failed to retry:", error);
    }
  };

  const handleExport = () => {
    const headers = ["ID", "Channel", "Status", "Priority", "Content", "Error", "Created At"];
    const rows = logs.map((log) => [
      log.id,
      log.channel,
      log.status || "",
      log.priority || "",
      log.content?.text || "",
      log.error || "",
      log.createdAt ? new Date(log.createdAt).toISOString() : "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-muted-foreground">Notification delivery history</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Channel</Label>
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v ?? "")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="wa">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(pagination.page)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">{pagination.total} logs found</div>

      {logs.length === 0 ? (
        <EmptyState
          title="No logs"
          description="Notification logs will appear here once you start sending."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant={log.channel === "wa" ? "default" : "secondary"}>
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
                  <TableCell className="max-w-[150px] truncate text-destructive">
                    {log.error || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSelectedLog(log); setDetailOpen(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {log.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRetry(log.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Channel:</span>{" "}
                  <Badge variant={selectedLog.channel === "wa" ? "default" : "secondary"}>
                    {selectedLog.channel === "wa" ? "WhatsApp" : "Email"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge className={statusColors[selectedLog.status || "pending"] || ""}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{" "}
                  <Badge variant="outline">{selectedLog.priority}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString("id-ID") : "-"}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Content:</p>
                <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                  {selectedLog.content?.text || "-"}
                </div>
              </div>
              {selectedLog.error && (
                <div>
                  <p className="text-sm text-destructive mb-1">Error:</p>
                  <div className="bg-red-50 text-red-800 p-3 rounded text-sm">
                    {selectedLog.error}
                  </div>
                </div>
              )}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Metadata:</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
