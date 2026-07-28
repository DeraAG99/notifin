"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft, Send, Clock, ScrollText, MessageSquare, Mail, Layers,
  Pencil, Check, X, Eye, Copy, Trash2,
} from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { NotificationTemplate, NotificationSchedule, NotificationLog, User } from "@/types";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [sending, setSending] = useState(false);

  // Inline edit state
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
        const t = templateData.data;
        setTemplate(t);
        setEditName(t.name);
        setEditChannel(t.channel);
        setEditSubject(t.subject || "");
        setEditContentText(t.content?.text || "");
        setEditContentHtml(t.content?.html || "");
        setEditIsActive(t.isActive ?? true);
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
        toast.add({ title: "Saved", description: "Template updated successfully", type: "success" });
      } else {
        toast.add({ title: "Error", description: data.error || "Failed to save", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Failed to save template", type: "error" });
    }
    setSaving(false);
  };

  const handleTestSend = async () => {
    if (!selectedUser || !template) return;
    setSending(true);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          userId: selectedUser,
          channel: template.channel === "both" ? "both" : template.channel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({
          title: "Test sent!",
          description: `Notification queued for ${data.data.logIds?.length || 1} channel(s)`,
          type: "success",
        });
        setTestSendOpen(false);
        setSelectedUser("");
        // Refresh logs
        const logsRes = await fetch(`/api/logs?pageSize=10`);
        const logsData = await logsRes.json();
        if (logsData.success) setLogs(logsData.data.items.filter((l: NotificationLog) => l.templateId === template?.id));
      } else {
        toast.add({ title: "Error", description: data.error || "Failed to send", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Failed to send test notification", type: "error" });
    }
    setSending(false);
  };

  const handleDelete = async () => {
    if (!template) return;
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Deleted", description: "Template has been deleted", type: "success" });
        router.push("/templates");
      } else {
        toast.add({ title: "Error", description: data.error || "Failed to delete", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Failed to delete template", type: "error" });
    }
    setDeleteOpen(false);
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const ChannelIcon = template.channel === "wa" ? MessageSquare : template.channel === "email" ? Mail : Layers;
  const channelLabel = template.channel === "wa" ? "WhatsApp" : template.channel === "email" ? "Email" : "Both";

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
                    <SelectItem value="both"><span className="flex items-center gap-2"><Layers className="h-3 w-3" /> Both</span></SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                  <span className="text-sm">{editIsActive ? "Active" : "Inactive"}</span>
                </div>
              </>
            ) : (
              <>
                <Badge variant={template.channel === "both" ? "outline" : template.channel === "wa" ? "default" : "secondary"}>
                  <ChannelIcon className="h-3 w-3 mr-1" />
                  {channelLabel}
                </Badge>
                <Badge variant={template.isActive ? "default" : "secondary"}>
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button onClick={saveEditing} disabled={saving}>
                <Check className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> Preview
              </Button>
              <Button onClick={() => setTestSendOpen(true)}>
                <Send className="h-4 w-4 mr-1" /> Test Send
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
              <ScrollText className="h-5 w-5" /> Message Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                {editChannel !== "wa" && (
                  <div className="space-y-2">
                    <Label>Email Subject</Label>
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="e.g. Your invoice for {{amount}}"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Message Content</Label>
                  <Textarea
                    value={editContentText}
                    onChange={(e) => setEditContentText(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder={"Hi {{name}},\n\nYour message here..."}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{variable}}"} for dynamic content. Detected:{" "}
                    {editContentText.match(/\{\{(\w+)\}\}/g)?.map((v) => v.replace(/\{\{|\}\}/g, "")).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "none"}
                  </p>
                </div>
                {editChannel !== "wa" && (
                  <div className="space-y-2">
                    <Label>HTML Template (optional)</Label>
                    <Textarea
                      value={editContentHtml}
                      onChange={(e) => setEditContentHtml(e.target.value)}
                      rows={5}
                      className="font-mono text-sm"
                      placeholder={'<h2>Hello {{name}}</h2>'}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {template.subject && (
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">Subject</Badge>
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
                    <Badge variant="outline" className="text-xs mb-2">HTML Preview</Badge>
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
                <p className="text-sm font-medium mb-2">Variables:</p>
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
              <CardTitle className="text-sm">Template Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{template.createdAt ? new Date(template.createdAt).toLocaleDateString("id-ID") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString("id-ID") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Channel</span>
                <span>{channelLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variables</span>
                <span>{template.variables?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {!editing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    navigator.clipboard.writeText(template.content.text);
                    toast.add({ title: "Copied!", description: "Template content copied to clipboard", type: "success" });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Content
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Schedules ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schedules</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <code className="font-mono text-xs">{s.cronExpression}</code>
                      <Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">
                        {s.isActive ? "On" : "Off"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs yet</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 5).map((log) => {
                    const user = users.find((u) => u.id === log.userId);
                    return (
                      <div key={log.id} className="flex items-center justify-between text-sm p-2 border rounded">
                        <div className="flex items-center gap-2 min-w-0">
                          {log.channel === "wa" ? <MessageSquare className="h-3 w-3 shrink-0" /> : <Mail className="h-3 w-3 shrink-0" />}
                          <span className="truncate text-muted-foreground">
                            {user?.name || "Unknown"}
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
            <DialogTitle>Preview: {template.name}</DialogTitle>
          </DialogHeader>
          <TemplatePreview template={template} />
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Test Send</DialogTitle>
            <DialogDescription>
              Send a test {channelLabel.toLowerCase()} notification using this template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a recipient" />
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
            {template.channel === "both" && (
              <p className="text-xs text-muted-foreground">
                This will send to both WhatsApp and Email for the selected user.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestSendOpen(false)}>Cancel</Button>
            <Button onClick={handleTestSend} disabled={!selectedUser || sending}>
              {sending ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{template.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
