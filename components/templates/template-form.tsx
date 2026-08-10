"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { useI18n } from "@/lib/i18n/context";
import {
  MessageSquare,
  Mail,
  Copy,
  Plus,
  X,
  Eye,
  Pencil,
} from "lucide-react";
import type { NotificationTemplate } from "@/types";

interface TemplateFormProps {
  template?: NotificationTemplate | null;
  onSuccess: () => void;
}

const AVAILABLE_VARIABLES = ["name", "email", "phone", "amount", "date", "message", "company"];

export function TemplateForm({ template, onSuccess }: TemplateFormProps) {
  const { t, tx } = useI18n();
  const [name, setName] = useState(template?.name || "");
  const [channel, setChannel] = useState<"wa" | "email" | "both">(template?.channel || "wa");
  const [subject, setSubject] = useState(template?.subject || "");
  const [contentText, setContentText] = useState(template?.content?.text || "");
  const [contentHtml, setContentHtml] = useState(template?.content?.html || "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const detectedVariables = useMemo(() => {
    const matches = contentText.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((v) => v.replace(/\{\{|\}\}/g, "")))];
  }, [contentText]);

  const getDefaultSampleData = useCallback((vars: string[]): Record<string, string> => {
    const defaults = t.templates.form.sampleDataDefault;
    const data: Record<string, string> = {};
    vars.forEach((v) => {
      switch (v) {
        case "name": data[v] = defaults.name; break;
        case "email": data[v] = defaults.email; break;
        case "phone": data[v] = defaults.phone; break;
        case "amount": data[v] = defaults.amount; break;
        case "date": data[v] = new Date().toLocaleDateString(); break;
        case "message": data[v] = defaults.message; break;
        case "company": data[v] = defaults.company; break;
        default: data[v] = `[${v}]`;
      }
    });
    return data;
  }, [t]);

  const [sampleData, setSampleData] = useState<Record<string, string>>(() =>
    getDefaultSampleData(template?.variables || [])
  );

  useEffect(() => {
    setSampleData((prev) => {
      const updated = { ...prev };
      detectedVariables.forEach((v) => {
        if (!(v in updated)) {
          updated[v] = getDefaultSampleData([v])[v] || "";
        }
      });
      Object.keys(updated).forEach((k) => {
        if (!detectedVariables.includes(k)) {
          delete updated[k];
        }
      });
      return updated;
    });
  }, [detectedVariables, getDefaultSampleData]);

  const renderedPreview = useMemo(() => {
    let text = contentText;
    Object.entries(sampleData).forEach(([key, value]) => {
      text = text.replaceAll(`{{${key}}}`, value);
    });
    return text;
  }, [contentText, sampleData]);

  const insertVariable = useCallback((variable: string) => {
    const textarea = document.getElementById("content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = contentText.substring(0, start) + `{{${variable}}}` + contentText.substring(end);
      setContentText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    } else {
      setContentText((prev) => prev + `{{${variable}}}`);
    }
  }, [contentText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const body = {
      name,
      channel,
      subject: channel !== "wa" ? subject : null,
      content: { text: contentText, html: contentHtml || undefined },
      variables: detectedVariables,
      isActive,
    };

    try {
      const url = template ? `/api/templates/${template.id}` : "/api/templates";
      const method = template ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({
          title: template ? t.templates.editTemplate : t.templates.createTemplate,
          description: `"${name}" berhasil ${template ? "diperbarui" : "dibuat"}.`,
          type: "success",
        });
        onSuccess();
      } else {
        toast.add({
          title: t.common.error,
          description: data.error || "Gagal menyimpan template",
          type: "error",
        });
      }
    } catch {
      toast.add({
        title: t.common.error,
        description: "Gagal menyimpan template. Silakan coba lagi.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const channelIcon = channel === "wa" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />;
  const channelLabel = channel === "wa" ? "WhatsApp" : channel === "email" ? "Email" : t.templates.channelLabel.both;

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor Panel */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Pencil className="h-4 w-4" /> {t.templates.form.editor}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t.templates.form.name}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.templates.form.namePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t.templates.form.channel}</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as "wa" | "email" | "both")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wa">
                    <span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</span>
                  </SelectItem>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</span>
                  </SelectItem>
                  <SelectItem value="both">
                    <span className="flex items-center gap-2">{channelIcon} {t.templates.channelLabel.both} (WA + Email)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {channel !== "wa" && (
            <div className="space-y-2">
              <Label htmlFor="subject">{t.templates.form.emailSubject}</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t.templates.form.emailSubjectPlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {t.templates.form.emailSubjectHint}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">{t.templates.form.messageContent}</Label>
              <span className="text-xs text-muted-foreground">
                {tx("templates.form.characterCount", { count: contentText.length })}
              </span>
            </div>
            <Textarea
              id="content"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder={"Halo {{name}},\n\n" + t.templates.form.messagePlaceholder}
              rows={8}
              required
              className="font-mono text-sm"
            />
          </div>

          {/* Variable chips */}
          <div className="space-y-2">
            <Label>{t.templates.form.variables}</Label>
            <div className="flex flex-wrap gap-2">
              {detectedVariables.length > 0 ? (
                detectedVariables.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {`{{${v}}}`}
                    <button
                      type="button"
                      onClick={() => {
                        setContentText(contentText.replaceAll(`{{${v}}}`, ""));
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">{t.templates.form.noVariables}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-xs text-muted-foreground mr-1">{t.templates.form.insert}</span>
              {AVAILABLE_VARIABLES.filter((v) => !detectedVariables.includes(v)).map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => insertVariable(v)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {`{{${v}}}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t.templates.form.variableHint}
            </p>
            <p className="text-xs text-muted-foreground bg-muted/50 border rounded-lg p-2">
              {t.templates.form.importHint}
            </p>
          </div>

          {channel !== "wa" && (
            <div className="space-y-2">
              <Label>{t.templates.form.htmlTemplate}</Label>
              <TiptapEditor
                content={contentHtml}
                onChange={setContentHtml}
                placeholder={t.templates.form.htmlEditorPlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {t.templates.form.htmlHint}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="active">{t.templates.form.active}</Label>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="h-4 w-4" /> {t.templates.form.livePreview}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(renderedPreview);
                toast.add({ title: t.common.copied, description: t.templates.form.previewCopied, type: "success" });
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> {t.common.copy}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {channelLabel}
                </CardTitle>
                {channel !== "wa" && subject && (
                  <Badge variant="outline" className="text-xs">
                    {t.templates.form.emailSubject}: {Object.entries(sampleData).reduce(
                      (s, [k, v]) => s.replaceAll(`{{${k}}}`, v),
                      subject
                    )}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contentText ? (
                <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {renderedPreview}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Mulai menulis untuk melihat preview...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Data Editor */}
          {detectedVariables.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.templates.form.sampleData}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {detectedVariables.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded min-w-[80px] font-mono">
                        {`{{${v}}}`}
                      </code>
                      <Input
                        value={sampleData[v] || ""}
                        onChange={(e) => setSampleData((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder={v}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t.templates.form.sampleDataHint}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <Button type="submit" disabled={loading}>
          {loading ? t.common.saving : template ? t.templates.form.updateButton : t.templates.form.createButton}
        </Button>
      </div>
    </form>
  );
}
