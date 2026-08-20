"use client";

import { useEffect, useMemo, useState } from "react";
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
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { describeCron, validateCron, getNextRun } from "@/lib/cron-utils";
import { Plus, Play, Trash2, Pencil } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { NotificationSchedule } from "@/types";

export default function SchedulesPage() {
  const { t, locale } = useI18n();
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<NotificationSchedule | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [userId, setUserId] = useState("");
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const cronPresets = [
    { label: t.schedules.presets.everyMinute, value: "* * * * *" },
    { label: t.schedules.presets.everyHour, value: "0 * * * *" },
    { label: t.schedules.presets.daily9am, value: "0 9 * * *" },
    { label: t.schedules.presets.weeklyMonday, value: "0 9 * * 1" },
    { label: t.schedules.presets.startOfMonth, value: "0 9 1 * *" },
    { label: t.schedules.presets.endOfMonth, value: "0 9 L * *" },
    { label: t.schedules.presets.startEndOfMonth, value: "0 9 1,L * *" },
  ];

  const cronCheck = useMemo(() => validateCron(cronExpression), [cronExpression]);

  const editingTimezone = editingSchedule?.timezone || "Asia/Jakarta";
  const nextRunPreview = useMemo(
    () => (cronCheck.valid ? getNextRun(cronExpression, editingTimezone) : null),
    [cronCheck.valid, cronExpression, editingTimezone],
  );

  const cronDescription = useMemo(
    () => (cronCheck.valid ? describeCron(cronExpression, locale) : ""),
    [cronCheck.valid, cronExpression, locale],
  );

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
    if (templatesData.success) setTemplates(templatesData.data.map((tmpl: { id: string; name: string }) => ({ id: tmpl.id, name: tmpl.name })));
    if (usersData.success) setUsers(usersData.data.items.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
  };

  useEffect(() => {
    fetchSchedules();
    fetchOptions();
  }, []);

  const openCreate = () => {
    setEditingSchedule(null);
    setTemplateId("");
    setUserId("");
    setCronExpression("0 9 * * *");
    setFormOpen(true);
  };

  const openEdit = (schedule: NotificationSchedule) => {
    setEditingSchedule(schedule);
    setTemplateId(schedule.templateId);
    setUserId(schedule.userId);
    setCronExpression(schedule.cronExpression);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronCheck.valid) return;
    try {
      if (editingSchedule) {
        await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, userId, cronExpression }),
        });
        toast.add({ title: t.common.success, description: "Jadwal berhasil diperbarui", type: "success" });
      } else {
        await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, userId, cronExpression, isActive: true }),
        });
        toast.add({ title: t.common.success, description: "Jadwal berhasil dibuat", type: "success" });
      }
      setFormOpen(false);
      fetchSchedules();
    } catch (error) {
      console.error("Gagal menyimpan jadwal:", error);
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
    if (!confirm(t.schedules.deleteConfirm)) return;
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      fetchSchedules();
      toast.add({ title: t.common.deleted, description: "Jadwal berhasil dihapus", type: "success" });
    } catch (error) {
      console.error("Gagal menghapus jadwal:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.schedules.title}</h1>
          <p className="text-muted-foreground">{t.schedules.description}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> {t.schedules.newSchedule}
        </Button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          title={t.schedules.noSchedules}
          description={t.schedules.noSchedulesDesc}
          actionLabel={t.schedules.newSchedule}
          actionHref="#"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.schedules.cron}</TableHead>
                <TableHead>{t.schedules.template}</TableHead>
                <TableHead>{t.schedules.user}</TableHead>
                <TableHead>{t.schedules.nextRun}</TableHead>
                <TableHead>{t.common.status}</TableHead>
                <TableHead className="text-right">{t.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => {
                const templateName = templates.find(
                  (tmpl) => tmpl.id === schedule.templateId
                )?.name;
                const userName = users.find(
                  (u) => u.id === schedule.userId
                )?.name;

                return (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div title={schedule.cronExpression} className="text-sm">
                        {describeCron(schedule.cronExpression, locale)}
                      </div>
                      <code className="text-xs text-muted-foreground">
                        {schedule.cronExpression}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm">
                      {templateName || schedule.templateId.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell className="text-sm">
                      {userName || schedule.userId.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell className="text-sm">
                      {schedule.nextRunAt
                        ? new Date(schedule.nextRunAt).toLocaleString(locale, {
                            timeZone: schedule.timezone || "Asia/Jakarta",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={schedule.isActive ? "default" : "secondary"}>
                        {schedule.isActive ? t.common.active : t.common.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t.common.edit}
                          onClick={() => openEdit(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? t.schedules.form.editTitle : t.schedules.form.title}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.schedules.template}</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t.schedules.form.selectTemplate} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.schedules.user}</Label>
              <Select value={userId} onValueChange={(v) => setUserId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t.schedules.form.selectUser} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.schedules.form.cronExpression}</Label>
              <div className="flex gap-2">
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * *"
                  aria-invalid={!cronCheck.valid}
                  className={!cronCheck.valid ? "border-destructive" : ""}
                  required
                />
                <Select value={cronExpression} onValueChange={(v) => setCronExpression(v ?? "")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t.schedules.form.presets} />
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
                {t.schedules.form.cronFormat}
              </p>
              {!cronCheck.valid && (
                <p className="text-xs text-destructive">
                  {t.schedules.form.cronInvalid}
                </p>
              )}
              {cronCheck.valid && cronDescription && (
                <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
                  <p>{cronDescription}</p>
                  {nextRunPreview && (
                    <p className="text-muted-foreground">
                      {t.schedules.form.nextRunPreview}:{" "}
                      {nextRunPreview.toLocaleString(locale, {
                        timeZone: editingTimezone,
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {t.schedules.form.cancel}
              </Button>
              <Button type="submit" disabled={!templateId || !userId || !cronCheck.valid}>
                {editingSchedule ? t.schedules.form.saveButton : t.schedules.form.createButton}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
