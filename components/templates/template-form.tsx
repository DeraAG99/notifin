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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  Pencil,
  Wand2,
  Code2,
} from "lucide-react";
import { ImportVariablesPicker } from "@/components/imports/import-variables-picker";
import { ETPP_BLOCKS, ETPP_PRESET } from "@/lib/templates/etpp-preset";
import { templateEngine } from "@/lib/template-engine";
import type { NotificationTemplate, User } from "@/types";

interface TemplateFormProps {
  template?: NotificationTemplate | null;
  onSuccess: () => void;
}

interface VariableGroup {
  key: "user" | "etpp" | "common";
  description?: "etppHint";
  variables: string[];
}

/** Loop/conditional keywords that appear inside `{{ }}` but name no variable. */
const BLOCK_TAGS = new Set(["each", "if", "else", "endif", "endeach"]);

/** Variables whose value is a flat list of strings, so the sample editor is one line per item. */
const LIST_VARIABLES = new Set(["rhk_iku", "rhk_lainnya"]);

/**
 * Variables whose value is a list of objects. `ra` is nested -- each group is a
 * Rencana Hasil Kerja with its Rencana Aksi beneath it -- so it cannot be edited
 * as one line per item; the sample editor gives it a row per group instead.
 */
/**
 * e-TPP list variables are nested structures (RHK -> aksi/output -> triwulan),
 * so they are edited as JSON rather than through per-field inputs. A typed
 * editor would only mirror the schema, and the schema is still moving -- while
 * a stale JSON sample shows up instantly in the preview.
 */
const NESTED_LIST_VARIABLES = new Set([
  "ra",
  "ra_output",
  "ra_output_tw",
  "rhk",
  "rhk_iku",
  "rhk_lainnya",
]);

/** Pretty-prints a sample value for the JSON editor. Never throws. */
function toJsonText(value: unknown): string {
  try {
    return JSON.stringify(value ?? [], null, 2);
  } catch {
    return "[]";
  }
}

/**
 * Parses the JSON editor's text, falling back to the last good value so a
 * half-typed edit cannot wipe the sample out of the preview.
 */
function fromJsonText(text: string, fallback: unknown): unknown {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    key: "user",
    variables: ["name", "jabatan", "unitKerja", "email", "phone"],
  },
  {
    key: "etpp",
    description: "etppHint",
    variables: [
      "bulan_ini",
      "tahun_ini",
      "nama_bulan",
      "nama_hari",
      "tanggal_ini",
      "triwulan_ini",
      "dialog_periode",
      "dialog_awal",
      "dialog_akhir",
      "rhk_iku",
      "rhk_lainnya",
      "ra",
      "ra_output",
      "ra_output_tw",
    ],
  },
  {
    key: "common",
    variables: ["amount", "date", "message", "company"],
  },
];


export function TemplateForm({ template, onSuccess }: TemplateFormProps) {
  const { t, tx } = useI18n();
  const [name, setName] = useState(template?.name || "");
  const [channel, setChannel] = useState<"wa" | "email" | "both">(template?.channel || "wa");
  const [subject, setSubject] = useState(template?.subject || "");
  const [contentText, setContentText] = useState(template?.content?.text || "");
  const [contentHtml, setContentHtml] = useState(template?.content?.html || "");
  /**
   * Both modes read and write `contentHtml`; this only decides which editor is
   * mounted. Defaulting to the visual editor keeps the behaviour of every
   * template saved before this toggle existed.
   */
  const [htmlMode, setHtmlMode] = useState<"visual" | "code">("visual");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const detectedVariables = useMemo(() => {
    // Must understand block tags, not just `{{name}}`. With a plain `[\w.]+`
    // pattern the variables inside `{{#each ra}}` / `{{#if ra.length}}` went
    // undetected, so the sample data never got the list and every block
    // previewed as empty -- the exact template that looks broken in the editor
    // but then sends fine in production.
    //
    // Both bodies are scanned: a template may keep its whole message in HTML and
    // leave `text` as a plain-text fallback, so reading one of them would leave
    // the other's tags out of the chips and unresolved in the preview.
    const matches = `${contentText}\n${contentHtml}`.match(/\{\{([\s\S]*?)\}\}/g);
    if (!matches) return [];
    const vars = new Set<string>();
    for (const match of matches) {
      const inner = match.slice(2, -2).trim();
      const token = inner.replace(/^[#/]/, "").split(/\s+/)[0];
      if (!token) continue;
      if (token === "this" || token.startsWith("@")) continue;
      if (BLOCK_TAGS.has(token)) continue;
      // `#if ra.length` guards a list; the sample data key is the list itself.
      vars.add(token.endsWith(".length") ? token.slice(0, -7) : token);
    }
    return [...vars];
  }, [contentText, contentHtml]);

  /**
   * Drop a variable everywhere it appears, in both bodies. Simple tags are a
   * literal replace; a variable used as a loop still has its wrapper removed,
   * otherwise the leftover `{{#each}}` body would render as raw text.
   */
  const removeVariable = useCallback((variable: string) => {
    const strip = (source: string): string =>
      source
        .replace(
          new RegExp(`\\{\\{#each ${variable}\\}\\}[\\s\\S]*?\\{\\{/each\\}\\}`, "g"),
          ""
        )
        .replace(
          new RegExp(`\\{\\{#if ${variable}\\.length\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, "g"),
          ""
        )
        .replaceAll(`{{${variable}}}`, "");

    // Both bodies carry the tag when a template duplicates its message, so
    // clearing only one would leave the chip reappearing from the other.
    setContentText(strip);
    setContentHtml((prev) => strip(prev));
  }, []);

  const getDefaultSampleData = useCallback((vars: string[]): Record<string, unknown> => {
    const defaults = t.templates.form.sampleDataDefault;
    const data: Record<string, unknown> = {};
    const table = defaults as unknown as Record<string, unknown>;
    vars.forEach((v) => {
      if (v in table) {
        data[v] = table[v];
        return;
      }
      if (v in NESTED_LIST_VARIABLES || v in LIST_VARIABLES) {
        // Lists stay arrays so `#each` and `.length` behave like they will in
        // production; a string here would preview as one long run-on line.
        data[v] = [];
        return;
      }
      if (v === "date") {
        data[v] = new Date().toLocaleDateString();
        return;
      }
      data[v] = `[${v}]`;
    });
    return data;
  }, [t]);

  const [sampleData, setSampleData] = useState<Record<string, unknown>>(() =>
    getDefaultSampleData(template?.variables || [])
  );

  useEffect(() => {
    setSampleData((prev) => {
      const updated = { ...prev };
      detectedVariables.forEach((v) => {
        if (!(v in updated)) {
          updated[v] = getDefaultSampleData([v])[v] ?? "";
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

  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});

  const jsonDraftFor = useCallback(
    (v: string): string => jsonDrafts[v] ?? toJsonText(sampleData[v]),
    [jsonDrafts, sampleData]
  );

  const setJsonDraft = useCallback((v: string, text: string) => {
    setJsonDrafts((prev) => ({ ...prev, [v]: text }));
    setSampleData((prev) => ({
      ...prev,
      [v]: fromJsonText(text, prev[v]),
    }));
  }, []);

  // Render through the real engine so `#each` / `#if` / `@number` preview the
  // same way the notification worker will. A plain `replaceAll` left the loop
  // tags visible in the preview and hid the fact that a block was malformed.
  const renderedPreview = useMemo(
    () => templateEngine.preview(contentText, sampleData),
    [contentText, sampleData]
  );

  // Same engine, same sample data -- the HTML preview has to render blocks the
  // same way the worker will, or a `{{#each}}` inside HTML looks fine here and
  // ships broken.
  const renderedHtmlPreview = useMemo(
    () => (contentHtml ? templateEngine.preview(contentHtml, sampleData) : ""),
    [contentHtml, sampleData]
  );

  const renderedSubject = useMemo(
    () => templateEngine.preview(subject, sampleData),
    [subject, sampleData]
  );

  // --- Real-user preview -------------------------------------------------
  // The sample data above proves the syntax; this proves the variables. A
  // sample hand-written to match the docs will happily render a typo-free
  // preview of a message no user will ever receive.
  const [previewUsers, setPreviewUsers] = useState<User[]>([]);
  const [previewUserId, setPreviewUserId] = useState("");
  const [realPreview, setRealPreview] = useState<{
    text: string;
    html?: string;
    subject?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users?pageSize=100")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setPreviewUsers(data.data.items as User[]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRealPreview = useCallback(
    async (userId: string, content: string, subj: string, html?: string) => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            // Only sent for email channels: WhatsApp never receives HTML, so
            // previewing it there would show markup that cannot be delivered.
            html: channel === "wa" ? undefined : html || undefined,
            subject: channel === "wa" ? undefined : subj,
            userId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setRealPreview(data.data.rendered);
        } else {
          toast.add({
            title: t.templates.previewUserFailed,
            description: data.error,
            type: "error",
          });
          setRealPreview(null);
        }
      } catch {
        setRealPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [channel, t.templates.previewUserFailed]
  );

  // Re-fetch as the admin types, but only once a user is picked. Without the
  // debounce this fires on every keystroke.
  useEffect(() => {
    if (!previewUserId || !contentText) return;
    const timer = setTimeout(() => {
      loadRealPreview(previewUserId, contentText, subject, contentHtml);
    }, 600);
    return () => clearTimeout(timer);
  }, [previewUserId, contentText, contentHtml, subject, loadRealPreview]);

  const handlePreviewUserChange = useCallback((value: string) => {
    setPreviewUserId(value);
    if (!value) setRealPreview(null);
  }, []);

  const previewText = realPreview?.text ?? renderedPreview;
  // `htmlMode` decides where a clicked variable chip lands: HTML Code mode edits
  // the HTML body, every other mode edits the plain-text body. Tiptap is not
  // reachable through getElementById, so code mode is the only HTML path that
  // can take a caret-accurate insert.
  const previewHtml = realPreview?.html ?? (contentHtml ? renderedHtmlPreview : "");

  const insertVariable = useCallback(
    (variable: string) => {
      const insertText = variable.includes("{{") ? variable : `{{${variable}}}`;
      const targetId = htmlMode === "code" ? "content-html" : "content";
      const source = htmlMode === "code" ? contentHtml : contentText;
      const setter = htmlMode === "code" ? setContentHtml : setContentText;
      const textarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setter(source.substring(0, start) + insertText + source.substring(end));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + insertText.length, start + insertText.length);
        }, 0);
      } else {
        setter((prev) => prev + insertText);
      }
    },
    [contentHtml, contentText, htmlMode]
  );

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
                      onClick={() => removeVariable(v)}
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

            {/* e-TPP preset: fills the whole message with a working template */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label className="text-xs">{t.templates.form.etppPresetTitle}</Label>
              <p className="text-[11px] text-muted-foreground">
                {t.templates.form.etppPresetHint}
              </p>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setContentText(ETPP_PRESET)}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  {t.templates.form.etppPresetButton}
                </Button>
                {ETPP_BLOCKS.map((b) => (
                  <Button
                    key={b.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => insertVariable(b.body)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tx("templates.form.etppBlock", { label: t.templates.form.blocks[b.label] })}
                  </Button>
                ))}
              </div>
            </div>

            {/* Variable chips, grouped so the e-TPP ones are findable */}
            <div className="space-y-2">
              {VARIABLE_GROUPS.map((group) => {
                const available = group.variables.filter(
                  (v) => !detectedVariables.includes(v)
                );
                if (available.length === 0) return null;
                return (
                  <div key={group.key} className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">
                      {tx("templates.form.variableGroup", {
                        group: t.templates.form.groups[group.key],
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {available.map((v) => (
                        <Button
                          key={v}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 font-mono text-xs"
                          onClick={() => insertVariable(v)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {`{{${v}}}`}
                        </Button>
                      ))}
                    </div>
                    {group.description && (
                      <p className="text-[11px] text-muted-foreground">
                        {t.templates.form[group.description]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t.templates.form.variableHint}
            </p>
            <p className="text-xs text-muted-foreground bg-muted/50 border rounded-lg p-2">
              {t.templates.form.importHint}
            </p>
            <ImportVariablesPicker onInsert={insertVariable} />
          </div>

          {channel !== "wa" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t.templates.form.htmlTemplate}</Label>
                <Tabs
                  value={htmlMode}
                  onValueChange={(v) => setHtmlMode(v as "visual" | "code")}
                >
                  <TabsList>
                    <TabsTrigger value="visual" className="text-xs">
                      {t.templates.form.htmlModeVisual}
                    </TabsTrigger>
                    <TabsTrigger value="code" className="text-xs">
                      <Code2 className="h-3 w-3 mr-1" />
                      {t.templates.form.htmlModeCode}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/*
                Only one editor is mounted at a time. Tiptap parses whatever it
                is given into a ProseMirror document and re-serialises it, so a
                designer email built from <table> and inline styles loses those
                the moment it round-trips. Keeping the raw textarea as a peer
                (rather than replacing Tiptap) means that HTML can be pasted
                verbatim, while the visual editor stays available for the simple
                case.
              */}
              {htmlMode === "visual" ? (
                <TiptapEditor
                  content={contentHtml}
                  onChange={setContentHtml}
                  placeholder={t.templates.form.htmlEditorPlaceholder}
                />
              ) : (
                <Textarea
                  id="content-html"
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  placeholder={t.templates.form.htmlCodePlaceholder}
                  rows={16}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              )}

              <p className="text-xs text-muted-foreground">
                {htmlMode === "visual"
                  ? t.templates.form.htmlHint
                  : t.templates.form.htmlCodeHint}
              </p>
              {htmlMode === "code" && contentHtml && (
                <p className="text-xs text-muted-foreground bg-muted/50 border rounded-lg p-2">
                  {t.templates.form.htmlCodeSameStore}
                </p>
              )}

              {contentHtml.trim() && (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                  {t.templates.form.htmlBrandWarning}
                </p>
              )}
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
                navigator.clipboard.writeText(previewText);
                toast.add({ title: t.common.copied, description: t.templates.form.previewCopied, type: "success" });
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> {t.common.copy}
            </Button>
          </div>

          {/* Real-user preview: renders the unsaved content through the same
              server path a send takes, so a wrong variable name shows up here
              instead of in the user's inbox. */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              {t.templates.previewUser}
            </Label>
            <Select value={previewUserId} onValueChange={(v) => handlePreviewUserChange(v ?? "")}>
              <SelectTrigger aria-label={t.templates.previewUserPlaceholder}>
                <SelectValue placeholder={t.templates.previewUserPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  {t.templates.previewUserPlaceholder}
                </SelectItem>
                {previewUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {u.jabatan ? ` — ${u.jabatan}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t.templates.previewUserHint}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {channelLabel}
                </CardTitle>
                {previewLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {channel !== "wa" && subject && (
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {t.templates.form.emailSubject}:{" "}
                    {realPreview?.subject ?? renderedSubject}
                  </Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* The HTML body, when there is one, IS the email: the worker's
                  `data.content.html || buildDefaultHtml(...)` means the wrapper
                  and its brand header/footer are skipped entirely. Rendering it
                  in its own frame keeps that honest instead of showing a text
                  preview that looks nothing like what arrives. */}
              {previewHtml ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">{t.templates.form.htmlPreviewLabel}</Label>
                  <iframe
                    title={t.templates.form.htmlPreviewLabel}
                    srcDoc={previewHtml}
                    /* Empty sandbox: no scripts, no forms, no same-origin.
                       Pasted HTML is untrusted input, and without this a
                       <script> or <img onerror> would execute against the app's
                       own origin and cookies. */
                    sandbox=""
                    className="h-[420px] w-full rounded-lg border bg-white"
                  />
                </div>
              ) : contentText ? (
                <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-lg p-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {previewText}
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
                  {detectedVariables.map((v) =>
                    v in NESTED_LIST_VARIABLES ? (
                      <div key={v} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {`{{${v}}}`}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {t.templates.form.sampleRaHint}
                          </span>
                        </div>
                        <Textarea
                          value={jsonDraftFor(v)}
                          onChange={(e) => setJsonDraft(v, e.target.value)}
                          rows={10}
                          spellCheck={false}
                          className="text-xs font-mono"
                        />
                      </div>
                    ) : (
                    <div key={v} className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded min-w-[80px] font-mono">
                        {`{{${v}}}`}
                      </code>
                      <Input
                        value={Array.isArray(sampleData[v])
                          ? sampleData[v].join("\n")
                          : ((sampleData[v] as string) ?? "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          // Lists are edited one item per line and stored back
                          // as an array so `#each` sees the right shape.
                          const isList = Array.isArray(sampleData[v]) || v in LIST_VARIABLES;
                          const value = isList
                            ? raw.split("\n").map((s) => s.trim()).filter(Boolean)
                            : raw;
                          setSampleData((prev) => ({ ...prev, [v]: value }));
                        }}
                        placeholder={v}
                        className="h-8 text-sm"
                      />
                    </div>
                    )
                  )}
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
