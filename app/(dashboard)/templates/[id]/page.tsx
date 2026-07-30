"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { useI18n } from "@/lib/i18n/context";
import {
  ArrowLeft, Send, Clock, ScrollText, MessageSquare, Mail, Layers,
  Pencil, Check, X, Eye, Copy, Trash2, Plus,
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { NotificationTemplate, NotificationSchedule, NotificationLog, User } from "@/types";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, tx } = useI18n();
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [sending, setSending] = useState(false);
  const [testVariables, setTestVariables] = useState<Array<{ key: string; value: string }>>([]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editChannel, setEditChannel] = useState<"wa" | "email" | "both">("wa");
  const [editSubject, setEditSubject] = useState("");
  const [editContentText, setEditContentText] = useState("");
  const [editContentHtml, setEditContentHtml] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string;
      const [templateRes, schedulesRes, logsRes, usersRes] = await Promise.all([
        fetch(`/api/templates/${id}`),
        fetch("/api/schedules"),
        fetch("/api/logs?pageSize=10"),
        fetch("/api/users?pageSize=100"),
      ]);

      const templateData = await templateRes.json();
      const schedulesData = await schedulesRes.json();
      const logsData = await logsRes.json();
      const usersData = await usersRes.json();

      if (templateData.success) {
        const tmpl = templateData.data;
        setTemplate(tmpl);
        setEditName(tmpl.name);
        setEditChannel(tmpl.channel);
        setEditSubject(tmpl.subject || "");
        setEditContentText(tmpl.content?.text || "");
        setEditContentHtml(tmpl.content?.html || "");
        setEditIsActive(tmpl.isActive ?? true);
        if (searchParams.get("edit") === "true") {
          setEditing(true);
        }
      }
      if (schedulesData.success) setSchedules(schedulesData.data.filter((s: NotificationSchedule) => s.templateId === id));
      if (logsData.success) setLogs(logsData.data.items.filter((l: NotificationLog) => l.templateId === id));
      if (usersData.success) setUsers(usersData.data.items);
    }
    fetchData();
  }, [params.id]);

  const startEditing = () => {
    if (!template) return;
    setEditName(template.name);
    setEditChannel(template.channel);
    setEditSubject(template.subject || "");
    setEditContentText(template.content?.text || "");
    setEditContentHtml(template.content?.html || "");
    setEditIsActive(template.isActive ?? true);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = async () => {
    if (!template) return;
    setSaving(true);
    const variables = editContentText.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/\{\{|\}\}/g, "")) || [];
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          channel: editChannel,
          subject: editChannel !== "wa" ? editSubject : null,
          content: { text: editContentText, html: editContentHtml || undefined },
          variables: [...new Set(variables)],
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplate(data.data);
        setEditing(false);
        toast.add({ title: t.common.success, description: "Template berhasil diperbarui", type: "success" });
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal menyimpan", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal menyimpan template", type: "error" });
    }
    setSaving(false);
  };

  const handleTestSend = async () => {
    if (!selectedUser || !template) return;
    setSending(true);

    const customVars: Record<string, string> = {};
    testVariables.forEach(({ key, value }) => {
      if (key.trim()) customVars[key.trim()] = value;
    });

    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          userId: selectedUser,
          channel: template.channel === "both" ? "both" : template.channel,
          variables: Object.keys(customVars).length > 0 ? customVars : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({
          title: t.templates.testSend.sent,
          description: tx("templates.testSend.sentDesc", { count: data.data.logIds?.length || 1 }),
          type: "success",
        });
        setTestSendOpen(false);
        setSelectedUser("");
        setTestVariables([]);
        const logsRes = await fetch(`/api/logs?pageSize=10`);
        const logsData = await logsRes.json();
        if (logsData.success) setLogs(logsData.data.items.filter((l: NotificationLog) => l.templateId === template?.id));
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal mengirim", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal mengirim notifikasi uji", type: "error" });
    }
    setSending(false);
  };

  const handleDelete = async () => {
    if (!template) return;
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: "Template berhasil dihapus", type: "success" });
        router.push("/templates");
      } else {
        toast.add({ title: t.common.error, description: data.error || "Gagal menghapus", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal menghapus template", type: "error" });
    }
    setDeleteOpen(false);
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t.common.loading}</div>
      </div>
    );
  }

  const ChannelIcon = template.channel === "wa" ? MessageSquare : template.channel === "email" ? Mail : Layers;
  const channelLabel = template.channel === "wa" ? "WhatsApp" : template.channel === "email" ? "Email" : t.templates.channelLabel.both;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-2xl font-bold h-auto py-1"
            />
          ) : (
            <h1 className="text-2xl font-bold">{template.name}</h1>
          )}
          <div className="flex items-center gap-2 mt-1">
            {editing ? (
              <>
                <Select value={editChannel} onValueChange={(v) => setEditChannel(v as "wa" | "email" | "both")}>
                  <SelectTrigger className="w-[160px] h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wa"><span className="flex items-center gap-2"><MessageSquare className="h-3 w-3" /> WhatsApp</span></SelectItem>
                    <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-3 w-3" /> Email</span></SelectItem>
                    <SelectItem value="both"><span className="flex items-center gap-2"><Layers className="h-3 w-3" /> {t.templates.channelLabel.both}</span></SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                  <span className="text-sm">{editIsActive ? t.common.active : t.common.inactive}</span>
                </div>
              </>
            ) : (
              <>
                <Badge variant={template.channel === "both" ? "outline" : template.channel === "wa" ? "default" : "secondary"}>
                  <ChannelIcon className="h-3 w-3 mr-1" />
                  {channelLabel}
                </Badge>
                <Badge variant={template.isActive ? "default" : "secondary"}>
                  {template.isActive ? t.common.active : t.common.inactive}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-1" /> {t.common.cancel}
              </Button>
              <Button onClick={saveEditing} disabled={saving}>
                <Check className="h-4 w-4 mr-1" />
                {saving ? t.common.saving : t.common.save}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> {t.common.edit}
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> {t.templates.preview}
              </Button>
              <Button onClick={() => setTestSendOpen(true)}>
                <Send className="h-4 w-4 mr-1" /> {t.templates.testSend.sendTest}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" /> {t.templates.form.messageContent}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                {editChannel !== "wa" && (
                  <div className="space-y-2">
                    <Label>{t.templates.form.emailSubject}</Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder={t.templates.form.emailSubjectPlaceholder}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t.templates.form.messageContent}</Label>
                  <Textarea
                    value={editContentText}
                    onChange={(e) => setEditContentText(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder={"Halo {{name}},\n\n" + t.templates.form.messagePlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">
                    {"{{variabel}}"} untuk konten dinamis. Terdeteksi:{" "}
                    {editContentText.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/\{\{|\}\}/g, "")).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "tidak ada"}
                  </p>
                </div>
                {editChannel !== "wa" && (
                  <div className="space-y-2">
                    <Label>{t.templates.form.htmlTemplate}</Label>
                    <TiptapEditor
                      content={editContentHtml}
                      onChange={setEditContentHtml}
                      placeholder={t.templates.form.htmlEditorPlaceholder}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {template.subject && (
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">{t.templates.form.emailSubject}</Badge>
                    <p className="text-sm font-medium bg-muted p-3 rounded-lg">{template.subject}</p>
                  </div>
                )}
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {template.content.text}
                  </div>
                </div>
                {template.content.html && (
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">{t.templates.preview} HTML</Badge>
                    <div
                      className="border rounded-lg p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: template.content.html }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Variables */}
            {!editing && template.variables && template.variables.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t.templates.variables}:</p>
                <div className="flex gap-2 flex-wrap">
                  {template.variables.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono">{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t.templates.templateInfo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.common.created}</span>
                <span>{template.createdAt ? new Date(template.createdAt).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.common.updated}</span>
                <span>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.common.channel}</span>
                <span>{channelLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.templates.variables}</span>
                <span>{template.variables?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {!editing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t.templates.quickActions}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    navigator.clipboard.writeText(template.content.text);
                    toast.add({ title: t.common.copied, description: t.templates.copyContent, type: "success" });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> {t.templates.copyContent}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> {t.templates.schedules} ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.templates.noSchedules}</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <code className="font-mono text-xs">{s.cronExpression}</code>
                      <Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">
                        {s.isActive ? t.common.active : t.common.inactive}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>{t.templates.recentActivity}</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.templates.noLogs}</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 5).map((log) => {
                    const user = users.find((u) => u.id === log.userId);
                    return (
                      <div key={log.id} className="flex items-center justify-between text-sm p-2 border rounded">
                        <div className="flex items-center gap-2 min-w-0">
                          {log.channel === "wa" ? <MessageSquare className="h-3 w-3 shrink-0" /> : <Mail className="h-3 w-3 shrink-0" />}
                          <span className="truncate text-muted-foreground">
                            {user?.name || t.common.unknown}
                          </span>
                        </div>
                        <Badge
                          variant={
                            log.status === "sent" || log.status === "delivered"
                              ? "default"
                              : log.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs shrink-0"
                        >
                          {log.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tx("templates.previewTitle", { name: template.name })}</DialogTitle>
          </DialogHeader>
          <TemplatePreview template={template} />
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.templates.testSend.title}</DialogTitle>
            <DialogDescription>
              {tx("templates.testSend.description", { channel: channelLabel.toLowerCase() })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.templates.testSend.selectUser}</Label>
              <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t.templates.testSend.chooseRecipient} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                      {user.phone && template.channel !== "email" ? ` (${user.phone})` : ""}
                      {user.email && template.channel !== "wa" ? ` (${user.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t.templates.testSend.customVariables}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setTestVariables((prev) => [...prev, { key: "", value: "" }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> {t.templates.testSend.addVariable}
                </Button>
              </div>
              {testVariables.length > 0 && (
                <div className="space-y-2">
                  {testVariables.map((field, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={field.key}
                        onChange={(e) => setTestVariables((prev) => prev.map((f, j) => j === i ? { ...f, key: e.target.value } : f))}
                        placeholder={t.templates.testSend.variableName}
                        className="h-8 text-sm flex-1"
                      />
                      <Input
                        value={field.value}
                        onChange={(e) => setTestVariables((prev) => prev.map((f, j) => j === i ? { ...f, value: e.target.value } : f))}
                        placeholder={t.templates.testSend.variableValue}
                        className="h-8 text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setTestVariables((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t.templates.testSend.variableHint}
              </p>
            </div>

            {template.channel === "both" && (
              <p className="text-xs text-muted-foreground">
                {t.templates.testSend.bothHint}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestSendOpen(false); setTestVariables([]); }}>{t.common.cancel}</Button>
            <Button onClick={handleTestSend} disabled={!selectedUser || sending}>
              {sending ? t.templates.testSend.sending : t.templates.testSend.sendTest}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.templates.deleteTemplate}</DialogTitle>
            <DialogDescription>
              {tx("templates.deleteConfirm", { name: template.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t.common.delete}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
