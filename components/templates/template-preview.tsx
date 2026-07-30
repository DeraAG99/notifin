"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import { Copy, MessageSquare, Mail } from "lucide-react";
import type { NotificationTemplate } from "@/types";

interface TemplatePreviewProps {
  template: NotificationTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const { t } = useI18n();
  const [sampleData, setSampleData] = useState<Record<string, string>>({});

  const variables = template.variables || [];

  const renderedText = useMemo(() => {
    let text = template.content.text;
    Object.entries(sampleData).forEach(([key, value]) => {
      text = text.replaceAll(`{{${key}}}`, value || `{{${key}}}`);
    });
    return text;
  }, [template.content.text, sampleData]);

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
                  onChange={(e) =>
                    setSampleData({ ...sampleData, [variable]: e.target.value })
                  }
                  placeholder={variable}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
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
        </CardHeader>
        <CardContent>
          {renderedSubject && (
            <div className="mb-3 pb-3 border-b">
              <Badge variant="outline" className="text-xs mb-1">{t.templates.form.emailSubject}</Badge>
              <p className="text-sm font-medium">{renderedSubject}</p>
            </div>
          )}
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
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
