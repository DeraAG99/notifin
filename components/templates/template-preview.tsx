"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { Copy, MessageSquare, Mail, Loader2 } from "lucide-react";
import type { NotificationTemplate, User } from "@/types";

interface TemplatePreviewProps {
  template: NotificationTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const { t, tx } = useI18n();
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [serverPreview, setServerPreview] = useState<{ text: string; html?: string } | null>(null);
  const [coverage, setCoverage] = useState<{ key: string; count: number; total: number }[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const variables = template.variables || [];

  useEffect(() => {
    fetch("/api/users?pageSize=100")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.data.items);
      })
      .catch(() => {});
  }, []);

  const loadServerPreview = async (userId: string, sample: Record<string, string>) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/templates/${template.id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleData: sample, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setServerPreview(data.data.rendered);
        if (data.data.coverage) setCoverage(data.data.coverage);
      }
    } catch {
      setServerPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUserChange = (value: string) => {
    setSelectedUserId(value);
    if (value) {
      loadServerPreview(value, sampleData);
    } else {
      setServerPreview(null);
    }
  };

  const handleSampleChange = (variable: string, value: string) => {
    const next = { ...sampleData, [variable]: value };
    setSampleData(next);
    if (selectedUserId) {
      loadServerPreview(selectedUserId, next);
    }
  };

  const renderedText = useMemo(() => {
    if (serverPreview) return serverPreview.text;
    let text = template.content.text;
    Object.entries(sampleData).forEach(([key, value]) => {
      text = text.replaceAll(`{{${key}}}`, value || `{{${key}}}`);
    });
    return text;
  }, [template.content.text, sampleData, serverPreview]);

  const renderedSubject = useMemo(() => {
    if (!template.subject) return null;
    let text = template.subject;
    Object.entries(sampleData).forEach(([key, value]) => {
      text = text.replaceAll(`{{${key}}}`, value || `{{${key}}}`);
    });
    return text;
  }, [template.subject, sampleData]);

  const channelLabel = template.channel === "wa" ? "WhatsApp" : template.channel === "email" ? "Email" : t.templates.channelLabel.both;
  const ChannelIcon = template.channel === "wa" ? MessageSquare : Mail;

  return (
    <div className="space-y-4">
      {/* Sample Data Input */}
      {variables.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t.templates.form.sampleData}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {variables.map((variable) => (
              <div key={variable} className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono min-w-[70px]">
                  {`{{${variable}}}`}
                </code>
                <Input
                  value={sampleData[variable] || ""}
                  onChange={(e) => handleSampleChange(variable, e.target.value)}
                  placeholder={variable}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview with real user */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t.templates.previewUser}</Label>
        <Select value={selectedUserId} onValueChange={(v) => handleUserChange(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder={t.templates.previewUserPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.templates.previewUserPlaceholder}</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t.templates.previewUserHint}</p>
      </div>

      {coverage.length > 0 && (
        <div className="rounded-lg border p-3 space-y-1">
          <Label className="text-xs">{t.templates.coverageTitle}</Label>
          {coverage.map((c) => (
            <p key={c.key} className="text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">{c.key}</span>:{" "}
              {tx("templates.coverage", { count: c.count, total: c.total })}
            </p>
          ))}
        </div>
      )}

      {/* Preview Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChannelIcon className="h-4 w-4" />
              {t.templates.preview} {channelLabel}
            </CardTitle>
            <div className="flex items-center gap-2">
              {loadingPreview && <Loader2 className="h-4 w-4 animate-spin" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(renderedText);
                  toast.add({ title: t.common.copied, description: t.templates.form.previewCopied, type: "success" });
                }}
              >
                <Copy className="h-4 w-4 mr-1" /> {t.common.copy}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderedSubject && (
            <div className="mb-3 pb-3 border-b">
              <Badge variant="outline" className="text-xs mb-1">{t.templates.form.emailSubject}</Badge>
              <p className="text-sm font-medium">{renderedSubject}</p>
            </div>
          )}
          <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {renderedText}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">{t.templates.form.sampleData} (Raw)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono">
            {template.content.text}
          </div>
          {template.subject && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs mb-1">{t.templates.form.emailSubject}</Badge>
              <p className="text-sm font-mono bg-muted p-2 rounded">{template.subject}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
