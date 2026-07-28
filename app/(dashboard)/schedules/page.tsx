"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Plus, Play, Trash2, Clock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { NotificationSchedule } from "@/types";

const cronPresets = [
  { label: "Setiap menit", value: "* * * * *" },
  { label: "Setiap jam", value: "0 * * * *" },
  { label: "Harian jam 9 pagi", value: "0 9 * * *" },
  { label: "Mingguan (Senin)", value: "0 9 * * 1" },
  { label: "Bulanan (tanggal 1)", value: "0 9 1 * *" },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [userId, setUserId] = useState("");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedules");
      const data = await res.json();
      if (data.success) setSchedules(data.data);
    } catch (error) {
      console.error("Gagal memuat jadwal:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    const [templatesRes, usersRes] = await Promise.all([
      fetch("/api/templates"),
      fetch("/api/users?pageSize=100"),
    ]);
    const templatesData = await templatesRes.json();
    const usersData = await usersRes.json();
    if (templatesData.success) setTemplates(templatesData.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    if (usersData.success) setUsers(usersData.data.items.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
  };

  useEffect(() => {
    fetchSchedules();
    fetchOptions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, userId, cronExpression, isActive: true }),
      });
      setFormOpen(false);
      fetchSchedules();
    } catch (error) {
      console.error("Gagal membuat jadwal:", error);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchSchedules();
    } catch (error) {
      console.error("Gagal mengubah jadwal:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      fetchSchedules();
    } catch (error) {
      console.error("Gagal menghapus jadwal:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jadwal</h1>
          <p className="text-muted-foreground">Kelola jadwal notifikasi otomatis</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Jadwal Baru
        </Button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          title="Belum ada jadwal"
          description="Buat jadwal untuk mengotomatiskan notifikasi."
          actionLabel="Jadwal Baru"
          actionHref="#"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cron</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Jalan Berikutnya</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {schedule.cronExpression}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">{schedule.templateId.slice(0, 8)}...</TableCell>
                  <TableCell className="text-sm">{schedule.userId.slice(0, 8)}...</TableCell>
                  <TableCell className="text-sm">
                    {schedule.nextRunAt
                      ? new Date(schedule.nextRunAt).toLocaleString("id-ID")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.isActive ? "default" : "secondary"}>
                      {schedule.isActive ? "Aktif" : "Jeda"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(schedule.id, schedule.isActive || false)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Jadwal Baru</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pengguna</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pengguna" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ekspresi Cron</Label>
              <div className="flex gap-2">
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * *"
                  required
                />
                <Select value={cronExpression} onValueChange={(v) => setCronExpression(v ?? "")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {cronPresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Format: menit jam hari bulan hari-dalam-minggu
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={!templateId || !userId}>
                Buat Jadwal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
