"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { Download, RefreshCw, Eye, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { NotificationLogEntry, NotificationStatus, PaginatedResponse } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  read: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};
const statuses: NotificationStatus[] = ["pending", "sent", "delivered", "read", "failed"];
const emptyFilters = { adminId: "", channel: "", status: "", startDate: "", endDate: "", search: "" };
type Tenant = { id: string; name: string; email: string };

export default function LogsPage() {
  const { t, tx, locale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const superadmin = user?.role === "superadmin";
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<NotificationLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<NotificationLogEntry | null>(null);
  const invalidDates = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && (key !== "adminId" || superadmin)) params.set(key, value);
  }
  const filterQuery = params.toString();

  const updateFilter = (key: keyof typeof emptyFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    setLoading(true);
  };

  useEffect(() => {
    if (!superadmin) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/logs/tenants", { signal: controller.signal });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || t.logs.loadError);
        setTenants(json.data);
      } catch (error) {
        if (!controller.signal.aborted) toast.add({ title: error instanceof Error ? error.message : t.logs.loadError, type: "error" });
      }
    };
    void load();
    return () => controller.abort();
  }, [superadmin, t.logs.loadError]);

  useEffect(() => {
    if (authLoading || !user || invalidDates) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/logs?${filterQuery}&page=${page}&pageSize=20`, { signal: controller.signal });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || t.logs.loadError);
        if (!controller.signal.aborted) setResult(json.data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : t.logs.loadError);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    // Debounce rapid filter changes and cancel stale requests.
    const timer = setTimeout(() => void load(), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filterQuery, page, refresh, authLoading, user, invalidDates, t.logs.loadError]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/logs/export?${filterQuery}`);
      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || t.logs.exportError);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `log-notifikasi-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.add({ title: error instanceof Error ? error.message : t.logs.exportError, type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleRetry = async (log: NotificationLogEntry) => {
    setRetrying(log.id);
    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: log.templateId, userId: log.userId, channel: log.channel, priority: log.priority || "normal" }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || t.logs.retryError);
      toast.add({ title: t.logs.retrySuccess, type: "success" });
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (error) {
      toast.add({ title: error instanceof Error ? error.message : t.logs.retryError, type: "error" });
    } finally {
      setRetrying(null);
    }
  };

  const date = (value: Date | null) => value ? `${new Date(value).toLocaleString(locale === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB` : "-";
  const statusBadge = (status: NotificationStatus | null) => <Badge className={statusColors[status || "pending"]}>{t.logs.statuses[status || "pending"]}</Badge>;
  const channelLabel = (channel: string) => channel === "wa" ? "WhatsApp" : channel === "email" ? "Email" : "WhatsApp & Email";
  const changePage = (value: number) => { setLoading(true); setPage(value); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">{t.logs.title}</h1><p className="text-muted-foreground">{t.logs.description}</p></div>
        <Button variant="outline" onClick={handleExport} disabled={exporting || loading || invalidDates || !!error || !result?.total} title={t.logs.exportHint}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{t.logs.exportExcel}
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {superadmin && <div className="space-y-2">
            <Label htmlFor="log-tenant">{t.logs.tenant}</Label>
            <Select value={filters.adminId || "all"} onValueChange={(value) => updateFilter("adminId", value === "all" ? "" : value || "")}>
              <SelectTrigger id="log-tenant" className="w-full"><SelectValue>{filters.adminId ? tenants.find((tenant) => tenant.id === filters.adminId)?.name : t.logs.allTenants}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">{t.logs.allTenants}</SelectItem>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.email})</SelectItem>)}</SelectContent>
            </Select>
          </div>}
          <div className="space-y-2"><Label htmlFor="log-search">{t.logs.recipient}</Label><Input id="log-search" value={filters.search} maxLength={200} placeholder={t.logs.searchRecipient} onChange={(event) => updateFilter("search", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="log-channel">{t.logs.channelFilter}</Label>
            <Select value={filters.channel || "all"} onValueChange={(value) => updateFilter("channel", value === "all" ? "" : value || "")}>
              <SelectTrigger id="log-channel" className="w-full"><SelectValue>{filters.channel ? channelLabel(filters.channel) : t.common.all}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">{t.common.all}</SelectItem><SelectItem value="wa">WhatsApp</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="both">WhatsApp & Email</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="log-status">{t.logs.statusFilter}</Label>
            <Select value={filters.status || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value || "")}>
              <SelectTrigger id="log-status" className="w-full"><SelectValue>{filters.status ? t.logs.statuses[filters.status as NotificationStatus] : t.common.all}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">{t.common.all}</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}>{t.logs.statuses[status]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="log-start">{t.logs.startDate}</Label><Input id="log-start" type="date" value={filters.startDate} max={filters.endDate || undefined} onChange={(event) => updateFilter("startDate", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="log-end">{t.logs.endDate}</Label><Input id="log-end" type="date" value={filters.endDate} min={filters.startDate || undefined} aria-invalid={invalidDates} onChange={(event) => updateFilter("endDate", event.target.value)} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t.logs.dateHint}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setFilters(emptyFilters); setPage(1); setLoading(true); setRefresh((value) => value + 1); }}>{t.logs.resetFilters}</Button>
            <Button variant="outline" size="sm" disabled={loading || invalidDates} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}><RefreshCw className="mr-1 h-4 w-4" />{t.common.refresh}</Button>
          </div>
        </div>
      </div>

      {invalidDates ? <p role="alert" className="text-sm text-destructive">{t.logs.invalidDates}</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading ? (
        <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t.common.loading}</div>
      ) : !result?.items.length ? <EmptyState title={t.logs.noLogs} description={t.logs.noLogsDesc} /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{tx("logs.logCount", { count: result.total })}</span><span>{t.logs.exportHint}</span></div>
          <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[960px]">
              <TableHeader><TableRow>
                <TableHead>{t.common.created}</TableHead>{superadmin && <TableHead>{t.logs.tenant}</TableHead>}<TableHead>{t.logs.recipient}</TableHead><TableHead>{t.common.channel}</TableHead><TableHead>{t.common.status}</TableHead><TableHead>{t.common.content}</TableHead><TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow></TableHeader>
              <TableBody>{result.items.map((log) => <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs">{date(log.createdAt)}</TableCell>
                {superadmin && <TableCell><div className="max-w-40 truncate" title={log.adminName || log.adminId}>{log.adminName || "-"}</div></TableCell>}
                <TableCell><div className="max-w-52 truncate font-medium">{log.recipientName || "-"}</div><div className="max-w-52 truncate text-xs text-muted-foreground">{log.channel === "email" ? log.recipientEmail : log.recipientPhone}</div></TableCell>
                <TableCell><Badge variant="outline">{channelLabel(log.channel)}</Badge></TableCell>
                <TableCell>{statusBadge(log.status)}</TableCell>
                <TableCell><p className="max-w-64 truncate" title={log.content?.text}>{log.content?.text || "-"}</p>{log.error && <p className="max-w-64 truncate text-xs text-destructive" title={log.error}>{log.error}</p>}</TableCell>
                <TableCell><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title={t.logs.detail} aria-label={t.logs.detail} onClick={() => setSelectedLog(log)}><Eye className="h-4 w-4" /></Button>
                  {log.status === "failed" && log.templateId && log.adminId === user?.adminId && <Button variant="ghost" size="icon" title={t.logs.retry} aria-label={t.logs.retry} disabled={retrying !== null} onClick={() => handleRetry(log)}><RefreshCw className={`h-4 w-4 ${retrying === log.id ? "animate-spin" : ""}`} /></Button>}
                </div></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => changePage(result.page - 1)}>{t.common.previous}</Button>
            <span className="text-sm">{t.common.page} {result.page} {t.common.of} {result.totalPages}</span>
            <Button variant="outline" size="sm" disabled={result.page >= result.totalPages} onClick={() => changePage(result.page + 1)}>{t.common.next}</Button>
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t.logs.detail}</DialogTitle></DialogHeader>
          {selectedLog && <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ...(superadmin ? [[t.logs.tenant, selectedLog.adminName || "-"]] : []),
                [t.logs.recipient, selectedLog.recipientName || "-"],
                [t.common.channel, channelLabel(selectedLog.channel)],
                [t.common.priority, selectedLog.priority || "normal"],
                ["WhatsApp", selectedLog.recipientPhone || "-"], ["Email", selectedLog.recipientEmail || "-"],
                [t.common.created, date(selectedLog.createdAt)],
                [t.logs.statuses.sent, date(selectedLog.sentAt)], [t.logs.statuses.delivered, date(selectedLog.deliveredAt)],
              ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}
              <div><dt className="text-muted-foreground">{t.common.status}</dt><dd>{statusBadge(selectedLog.status)}</dd></div>
            </dl>
            <div><p className="mb-1 text-sm text-muted-foreground">{t.common.content}</p><div className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">{selectedLog.content?.text || "-"}</div></div>
            {selectedLog.error && <div><p className="mb-1 text-sm text-destructive">{t.common.error}</p><div className="whitespace-pre-wrap break-words rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{selectedLog.error}</div></div>}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && <details><summary className="cursor-pointer text-sm text-muted-foreground">{t.logs.metadata}</summary><pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selectedLog.metadata, null, 2)}</pre></details>}
            <p className="break-all text-xs text-muted-foreground">ID: {selectedLog.id}</p>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
