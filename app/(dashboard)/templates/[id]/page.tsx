"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Clock, ScrollText, MessageSquare, Mail, Layers, Pencil } from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import { TemplateForm } from "@/components/templates/template-form";
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
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [sending, setSending] = useState(false);

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

      if (templateData.success) setTemplate(templateData.data);
      if (schedulesData.success) setSchedules(schedulesData.data.filter((s: NotificationSchedule) => s.templateId === id));
      if (logsData.success) setLogs(logsData.data.items.filter((l: NotificationLog) => l.templateId === id));
      if (usersData.success) setUsers(usersData.data.items);
    }
    fetchData();
  }, [params.id]);

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
      } else {
        toast.add({ title: "Error", description: data.error || "Failed to send", type: "error" });
      }
    } catch {
      toast.add({ title: "Error", description: "Failed to send test notification", type: "error" });
    }
    setSending(false);
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
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={template.channel === "both" ? "outline" : template.channel === "wa" ? "default" : "secondary"}>
              <ChannelIcon className="h-3 w-3 mr-1" />
              {channelLabel}
            </Badge>
            <Badge variant={template.isActive ? "default" : "secondary"}>
              {template.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button onClick={() => setTestSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Test Send
          </Button>
        </div>
      </div>

      {/* Content & Info Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Content Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" /> Message Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {template.variables && template.variables.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Variables:</p>
                <div className="flex gap-2 flex-wrap">
                  {template.variables.map((v) => (
                    <Badge key={v} variant="outline">{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Schedules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Schedules ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schedules configured</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <code className="font-mono">{s.cronExpression}</code>
                      <Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">
                        {s.isActive ? "Active" : "Off"}
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
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {log.channel === "wa" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                        <span className="text-muted-foreground">
                          {log.sentAt ? new Date(log.sentAt).toLocaleDateString("id-ID") : "—"}
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
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                    </div>
                  ))}
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <TemplateForm
            template={template}
            onSuccess={() => {
              setEditOpen(false);
              // Refresh template data
              fetch(`/api/templates/${params.id}`)
                .then((r) => r.json())
                .then((data) => { if (data.success) setTemplate(data.data); });
              toast.add({ title: "Updated", description: "Template updated successfully", type: "success" });
            }}
          />
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
    </div>
  );
}
