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
  Wand2,
} from "lucide-react";
import { ImportVariablesPicker } from "@/components/imports/import-variables-picker";
import { ETPP_BLOCKS, ETPP_PRESET } from "@/lib/templates/etpp-preset";
import { templateEngine } from "@/lib/template-engine";
import type { KodeLabel } from "@/lib/users/etpp-extract";
import type { NotificationTemplate } from "@/types";

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
const NESTED_LIST_VARIABLES = new Set(["ra"]);

interface RaSampleGroup {
  rhk: string;
  kode_sumber: KodeLabel;
  aksi: string[];
}

const KODE_LABELS: KodeLabel[] = ["IKU", "Lainnya"];

/**
 * Coerces whatever `sampleDataDefault.ra` holds into the nested shape.
 *
 * Defensive because a legacy flat entry (a bare string, or a `{rhk, aksi}`
 * pair with a single action) still round-trips through a cached i18n bundle or
 * a saved editor session. A flat value would preview as a row of undefined and
 * teach the admin the wrong shape.
 *
 * `kode_sumber` defaults rather than dropping out: the template prints it as
 * `[{{kode_sumber}}]`, and a group without one previews as an empty pair of
 * brackets -- which looks like a rendering bug rather than missing sample data.
 */
function normalizeRaSample(value: unknown): RaSampleGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): RaSampleGroup | null => {
      if (typeof row === "string") return row.trim() ? { rhk: row.trim(), kode_sumber: "Lainnya", aksi: [] } : null;
      if (!row || typeof row !== "object") return null;
      const { rhk, kode_sumber, aksi } = row as { rhk?: unknown; kode_sumber?: unknown; aksi?: unknown };
      const label = typeof rhk === "string" ? rhk.trim() : "";
      if (!label) return null;
      const list = Array.isArray(aksi) ? aksi : typeof aksi === "string" ? aksi.split("\n") : [];
      return {
        rhk: label,
        kode_sumber: KODE_LABELS.includes(kode_sumber as KodeLabel) ? (kode_sumber as KodeLabel) : "Lainnya",
        aksi: list.map((a) => String(a).trim()).filter(Boolean),
      };
    })
    .filter((g): g is RaSampleGroup => g !== null);
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    key: "user",
    variables: ["name", "jabatan", "unitKerja", "email", "phone"],
  },
  {
    key: "etpp",
    description: "etppHint",
    variables: ["bulan_ini", "rhk_iku", "rhk_lainnya", "ra"],
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
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [loading, setLoading] = useState(false);

  const detectedVariables = useMemo(() => {
    // Must understand block tags, not just `{{name}}`. With a plain `[\w.]+`
    // pattern the variables inside `{{#each ra}}` / `{{#if ra.length}}` went
    // undetected, so the sample data never got the list and every block
    // previewed as empty -- the exact template that looks broken in the editor
    // but then sends fine in production.
    const matches = contentText.match(/\{\{([\s\S]*?)\}\}/g);
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
  }, [contentText]);

  /**
   * Drop a variable everywhere it appears. Simple tags are a literal replace;
   * a variable used as a loop still has its wrapper removed, otherwise the
   * leftover `{{#each}}` body would render as raw text.
   */
  const removeVariable = useCallback((variable: string) => {
    setContentText((prev) =>
      prev
        .replace(
          new RegExp(`\\{\\{#each ${variable}\\}\\}[\\s\\S]*?\\{\\{/each\\}\\}`, "g"),
          ""
        )
        .replace(
          new RegExp(`\\{\\{#if ${variable}\\.length\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, "g"),
          ""
        )
        .replaceAll(`{{${variable}}}`, "")
    );
  }, []);

  const getDefaultSampleData = useCallback((vars: string[]): Record<string, unknown> => {
    const defaults = t.templates.form.sampleDataDefault;
    const data: Record<string, unknown> = {};
    vars.forEach((v) => {
      switch (v) {
        case "name": data[v] = defaults.name; break;
        case "email": data[v] = defaults.email; break;
        case "phone": data[v] = defaults.phone; break;
        case "jabatan": data[v] = defaults.jabatan || ""; break;
        case "unitKerja": data[v] = defaults.unitKerja || ""; break;
        case "amount": data[v] = defaults.amount; break;
        case "date": data[v] = new Date().toLocaleDateString(); break;
        case "message": data[v] = defaults.message; break;
        case "company": data[v] = defaults.company; break;
        case "bulan_ini": data[v] = defaults.bulan_ini || ""; break;
        // Lists stay arrays so `#each` and `.length` behave like they will in
        // production; a string here would preview as one long run-on line.
        case "rhk_iku": data[v] = defaults.rhk_iku || []; break;
        case "rhk_lainnya": data[v] = defaults.rhk_lainnya || []; break;
        // Nested, like the real extractor: one group per RHK, actions beneath.
        // A flat list here would preview fine but then break in production.
        case "ra": data[v] = normalizeRaSample(defaults.ra); break;
        default: data[v] = `[${v}]`;
      }
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

  const getRaGroups = useCallback(
    (v: string): RaSampleGroup[] => normalizeRaSample(sampleData[v]),
    [sampleData]
  );

  const writeRaGroups = useCallback((v: string, groups: RaSampleGroup[]) => {
    setSampleData((prev) => ({ ...prev, [v]: groups }));
  }, []);

  const addRaGroup = useCallback(
    (v: string) => {
      writeRaGroups(v, [...normalizeRaSample(sampleData[v]), { rhk: "", kode_sumber: "Lainnya", aksi: [] }]);
    },
    [sampleData, writeRaGroups]
  );

  const updateRaGroup = useCallback(
    (v: string, index: number, patch: Partial<RaSampleGroup>) => {
      const groups = normalizeRaSample(sampleData[v]).map((g, i) =>
        i === index ? { ...g, ...patch } : g
      );
      writeRaGroups(v, groups);
    },
    [sampleData, writeRaGroups]
  );

  const removeRaGroup = useCallback(
    (v: string, index: number) => {
      writeRaGroups(
        v,
        normalizeRaSample(sampleData[v]).filter((_, i) => i !== index)
      );
    },
    [sampleData, writeRaGroups]
  );

  // Render through the real engine so `#each` / `#if` / `@number` preview the
  // same way the notification worker will. A plain `replaceAll` left the loop
  // tags visible in the preview and hid the fact that a block was malformed.
  const renderedPreview = useMemo(
    () => templateEngine.preview(contentText, sampleData),
    [contentText, sampleData]
  );

  const renderedSubject = useMemo(
    () => templateEngine.preview(subject, sampleData),
    [subject, sampleData]
  );

  const insertVariable = useCallback((variable: string) => {
    const insertText = variable.includes("{{") ? variable : `{{${variable}}}`;
    const textarea = document.getElementById("content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = contentText.substring(0, start) + insertText + contentText.substring(end);
      setContentText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertText.length, start + insertText.length);
      }, 0);
    } else {
      setContentText((prev) => prev + insertText);
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
                    {t.templates.form.emailSubject}: {renderedSubject}
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
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-7 text-xs"
                            onClick={() => addRaGroup(v)}
                          >
                            <Plus className="h-3 w-3" />
                            {t.templates.form.sampleRaAddGroup}
                          </Button>
                        </div>
                        {getRaGroups(v).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t.templates.form.sampleRaEmpty}
                          </p>
                        ) : (
                          getRaGroups(v).map((group, gi) => (
                            <div
                              key={`${v}-${gi}`}
                              className="flex gap-2 items-start rounded bg-muted/40 p-2"
                            >
                              <div className="flex-1 space-y-1">
                                <Select
                                  value={group.kode_sumber}
                                  onValueChange={(value) =>
                                    updateRaGroup(v, gi, {
                                      kode_sumber: value as KodeLabel,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className="h-8 text-sm"
                                    aria-label={t.templates.form.sampleRaKodePlaceholder}
                                  >
                                    <SelectValue placeholder={t.templates.form.sampleRaKodePlaceholder} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {KODE_LABELS.map((kode) => (
                                      <SelectItem key={kode} value={kode}>
                                        {kode}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={group.rhk}
                                  onChange={(e) =>
                                    updateRaGroup(v, gi, { rhk: e.target.value })
                                  }
                                  placeholder={t.templates.form.sampleRaRhkPlaceholder}
                                  className="h-8 text-sm"
                                />
                                <Textarea
                                  value={group.aksi.join("\n")}
                                  onChange={(e) =>
                                    updateRaGroup(v, gi, {
                                      aksi: e.target.value
                                        .split("\n")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder={t.templates.form.sampleRaAksiPlaceholder}
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0"
                                onClick={() => removeRaGroup(v, gi)}
                                aria-label={t.templates.form.sampleRaRemoveGroup}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        )}
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
