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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Send, Clock, ScrollText } from "lucide-react";
import { TemplatePreview } from "@/components/templates/template-preview";
import type { NotificationTemplate, NotificationSchedule, NotificationLog } from "@/types";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string;
      const [templateRes, schedulesRes, logsRes] = await Promise.all([
        fetch(`/api/templates/${id}`),
        fetch("/api/schedules"),
        fetch("/api/logs?pageSize=10"),
      ]);

      const templateData = await templateRes.json();
      const schedulesData = await schedulesRes.json();
      const logsData = await logsRes.json();

      if (templateData.success) setTemplate(templateData.data);
      if (schedulesData.success) setSchedules(schedulesData.data.filter((s: NotificationSchedule) => s.templateId === id));
      if (logsData.success) setLogs(logsData.data.items.filter((l: NotificationLog) => l.templateId === id));
    }
    fetchData();
  }, [params.id]);

  if (!template) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={template.channel === "wa" ? "default" : "secondary"}>
              {template.channel === "wa" ? "WhatsApp" : "Email"}
            </Badge>
            <Badge variant={template.isActive ? "default" : "secondary"}>
              {template.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button onClick={() => setTestSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Test Send
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" /> Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
              {template.content.text}
            </div>
            {template.variables && template.variables.length > 0 && (
              <div className="mt-4">
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Schedules ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schedules</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 border rounded">
                      <code className="text-sm">{s.cronExpression}</code>
                      <Badge variant={s.isActive ? "default" : "secondary"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm p-2 border rounded">
                      <Badge variant="outline">{log.channel}</Badge>
                      <Badge variant={log.status === "failed" ? "destructive" : "default"}>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Template</DialogTitle>
          </DialogHeader>
          <TemplatePreview template={template} />
        </DialogContent>
      </Dialog>

      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Send</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This feature will be available once you have users in the system.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
