"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Pencil, Trash2, Boxes, PlusCircle, X } from "lucide-react";

type Engine = "table" | "ekinerja-json";
type Format = "html" | "xlsx";

const FIELD_OPTIONS = [
  "kegiatan",
  "indikator",
  "satuan",
  "konsolidasi",
  "polarisasi",
  "targetTahunan",
  "triwulan",
  "target",
  "realisasi",
  "capaian",
  "keterangan",
  "validasi",
  "keteranganValidasi",
] as const;

const MONEV_TEMPLATE = {
  headerRow: ["Indikator Kinerja", "Triwulan"],
  triwulanRegex: "tw\\s*(?:iv|[1-4]|i{1,3})",
  columns: [
    { field: "kegiatan", match: "kegiatan", mode: "contains", exclude: "" },
    { field: "indikator", match: "indikator", mode: "contains", exclude: "" },
    { field: "satuan", match: "satuan", mode: "exact", exclude: "" },
    { field: "konsolidasi", match: "konsolidasi", mode: "contains", exclude: "" },
    { field: "polarisasi", match: "polarisasi", mode: "contains", exclude: "" },
    { field: "targetTahunan", match: "target tahunan", mode: "contains", exclude: "" },
    { field: "triwulan", match: "triwulan", mode: "exact", exclude: "" },
    { field: "target", match: "target", mode: "exact", exclude: "" },
    { field: "realisasi", match: "realisasi", mode: "exact", exclude: "" },
    { field: "capaian", match: "capaian", mode: "contains", exclude: "" },
    { field: "keterangan", match: "keterangan", mode: "contains-exclude", exclude: "keterangan validasi" },
    { field: "validasi", match: "validasi", mode: "exact", exclude: "" },
    { field: "keteranganValidasi", match: "keterangan validasi", mode: "exact", exclude: "" },
  ],
};

interface TypeRow {
  id: string;
  key: string;
  name: string;
  engine: Engine;
  format: Format;
  detectRules: string[];
  columnMapping: {
    headerRow: string[];
    triwulanRegex: string;
    columns: { field: string; match: string; mode: string; exclude?: string }[];
  } | null;
  isActive: boolean | null;
  createdAt: string | null;
}

interface FormState {
  id?: string;
  key: string;
  name: string;
  engine: Engine;
  format: Format;
  isActive: boolean;
  detectRules: string[];
  headerRow: string[];
  triwulanRegex: string;
  columns: { field: string; match: string; mode: string; exclude: string }[];
}

const emptyForm: FormState = {
  key: "",
  name: "",
  engine: "table",
  format: "html",
  isActive: true,
  detectRules: [],
  headerRow: [],
  triwulanRegex: "tw\\s*(?:iv|[1-4]|i{1,3})",
  columns: [],
};

export function ImportTypesManager() {
  const { t } = useI18n();
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fieldLabel = (f: string) =>
    t.importTypes.fieldLabels[f as keyof typeof t.importTypes.fieldLabels] || f;

  const fetchTypes = async () => {
    try {
      const res = await fetch("/api/imports/types");
      const data = await res.json();
      if (data.success) setTypes(data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openNew = () => {
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (type: TypeRow) => {
    const mapping = type.columnMapping;
    setForm({
      id: type.id,
      key: type.key,
      name: type.name,
      engine: type.engine,
      format: type.format,
      isActive: type.isActive ?? true,
      detectRules: type.detectRules || [],
      headerRow: mapping?.headerRow || [],
      triwulanRegex: mapping?.triwulanRegex || "tw\\s*(?:iv|[1-4]|i{1,3})",
      columns: (mapping?.columns || []).map((c) => ({
        field: c.field,
        match: c.match,
        mode: c.mode,
        exclude: c.exclude || "",
      })),
    });
    setDialogOpen(true);
  };

  const fillMonev = () => {
    setForm((f) => ({
      ...f,
      engine: "table",
      headerRow: [...MONEV_TEMPLATE.headerRow],
      triwulanRegex: MONEV_TEMPLATE.triwulanRegex,
      columns: MONEV_TEMPLATE.columns.map((c) => ({ ...c })),
    }));
  };

  const handleSave = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toast.add({ title: t.common.error, description: "Key & Nama wajib diisi", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const columnMapping =
        form.engine === "table"
          ? {
              headerRow: form.headerRow.filter((k) => k.trim()),
              triwulanRegex: form.triwulanRegex,
              columns: form.columns
                .filter((c) => c.field && c.match.trim())
                .map((c) => ({
                  field: c.field,
                  match: c.match.trim(),
                  mode: c.mode,
                  ...(c.mode === "contains-exclude" && c.exclude ? { exclude: c.exclude.trim() } : {}),
                })),
            }
          : null;

      const body = {
        key: form.key.trim(),
        name: form.name.trim(),
        engine: form.engine,
        format: form.format,
        isActive: form.isActive,
        detectRules: form.detectRules.filter((k) => k.trim()),
        columnMapping,
      };

      const url = form.id ? `/api/imports/types/${form.id}` : "/api/imports/types";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.success, description: t.importTypes.saved, type: "success" });
        setDialogOpen(false);
        fetchTypes();
      } else {
        toast.add({ title: t.common.error, description: data.error || t.importTypes.createFailed, type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: t.importTypes.createFailed, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: TypeRow) => {
    if (!confirm(t.importTypes.deleteConfirm.replace("{name}", type.name))) return;
    try {
      const res = await fetch(`/api/imports/types/${type.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: t.common.deleted, description: t.importTypes.deleteType, type: "success" });
        fetchTypes();
      }
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          {t.importTypes.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.importTypes.description}</p>

        {loading ? (
          <div className="py-6 text-center text-muted-foreground text-sm">{t.common.loading}</div>
        ) : (
          <div className="space-y-2">
            {types.map((type) => (
              <div key={type.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{type.name}</span>
                    <Badge variant="secondary" className="font-mono">{type.key}</Badge>
                    <Badge variant={type.isActive ? "default" : "secondary"}>
                      {type.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {type.engine === "table" ? "table" : "ekinerja-json"} · {type.format} ·{" "}
                    {type.detectRules.join(", ") || "-"}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(type)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(type)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> {t.importTypes.addType}
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? t.importTypes.editType : t.importTypes.addType}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {form.engine === "table" && (
              <Button type="button" variant="outline" size="sm" onClick={fillMonev}>
                {t.importTypes.fillMonev}
              </Button>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.importTypes.key}</Label>
                <Input
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })}
                  placeholder="monev-custom"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.importTypes.name}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Monev Custom"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t.importTypes.engine}</Label>
                <Select
                  value={form.engine}
                  onValueChange={(v) => setForm({ ...form, engine: (v as Engine) ?? "table" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">table</SelectItem>
                    <SelectItem value="ekinerja-json">ekinerja-json</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.importTypes.format}</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm({ ...form, format: (v as Format) ?? "html" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">html</SelectItem>
                    <SelectItem value="xlsx">xlsx</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                  <Label>{t.importTypes.active}</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.importTypes.detectRules}</Label>
              <p className="text-xs text-muted-foreground">{t.importTypes.detectRulesHint}</p>
              <div className="flex flex-wrap gap-2">
                {form.detectRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      value={rule}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.detectRules];
                          next[i] = e.target.value;
                          return { ...f, detectRules: next };
                        })
                      }
                      className="h-8 w-48 text-sm"
                    />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, detectRules: f.detectRules.filter((_, j) => j !== i) }))}>
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" className="h-8"
                  onClick={() => setForm((f) => ({ ...f, detectRules: [...f.detectRules, ""] }))}>
                  <PlusCircle className="h-4 w-4 mr-1" /> {t.importTypes.addKeyword}
                </Button>
              </div>
            </div>

            {form.engine === "table" && (
              <>
                <div className="space-y-2">
                  <Label>{t.importTypes.headerRow}</Label>
                  <p className="text-xs text-muted-foreground">{t.importTypes.headerRowHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {form.headerRow.map((k, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Input
                          value={k}
                          onChange={(e) =>
                            setForm((f) => {
                              const next = [...f.headerRow];
                              next[i] = e.target.value;
                              return { ...f, headerRow: next };
                            })
                          }
                          className="h-8 w-48 text-sm"
                        />
                        <button type="button" onClick={() => setForm((f) => ({ ...f, headerRow: f.headerRow.filter((_, j) => j !== i) }))}>
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-8"
                      onClick={() => setForm((f) => ({ ...f, headerRow: [...f.headerRow, ""] }))}>
                      <PlusCircle className="h-4 w-4 mr-1" /> {t.importTypes.addKeyword}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t.importTypes.triwulanRegex}</Label>
                  <Input
                    value={form.triwulanRegex}
                    onChange={(e) => setForm({ ...form, triwulanRegex: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.importTypes.columns}</Label>
                  <div className="space-y-2">
                    {form.columns.map((col, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <Select
                          value={col.field}
                          onValueChange={(v) =>
                            setForm((f) => {
                              const next = [...f.columns];
                              next[i] = { ...next[i], field: v ?? "" };
                              return { ...f, columns: next };
                            })
                          }
                        >
                          <SelectTrigger className="col-span-3 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>{fieldLabel(f)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={col.match}
                          onChange={(e) =>
                            setForm((f) => {
                              const next = [...f.columns];
                              next[i] = { ...next[i], match: e.target.value };
                              return { ...f, columns: next };
                            })
                          }
                          placeholder={t.importTypes.match}
                          className="col-span-3 h-8 text-xs"
                        />
                        <Select
                          value={col.mode}
                          onValueChange={(v) =>
                            setForm((f) => {
                              const next = [...f.columns];
                              next[i] = { ...next[i], mode: v ?? "exact" };
                              return { ...f, columns: next };
                            })
                          }
                        >
                          <SelectTrigger className="col-span-2 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exact">{t.importTypes.modeExact}</SelectItem>
                            <SelectItem value="contains">{t.importTypes.modeContains}</SelectItem>
                            <SelectItem value="contains-exclude">{t.importTypes.modeContainsExclude}</SelectItem>
                          </SelectContent>
                        </Select>
                        {col.mode === "contains-exclude" && (
                          <Input
                            value={col.exclude}
                            onChange={(e) =>
                              setForm((f) => {
                                const next = [...f.columns];
                                next[i] = { ...next[i], exclude: e.target.value };
                                return { ...f, columns: next };
                              })
                            }
                            placeholder={t.importTypes.exclude}
                            className="col-span-3 h-8 text-xs"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, columns: f.columns.filter((_, j) => j !== i) }))}
                          className="col-span-1 justify-self-center"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          columns: [...f.columns, { field: "", match: "", mode: "exact", exclude: "" }],
                        }))
                      }>
                      <PlusCircle className="h-4 w-4 mr-1" /> {t.importTypes.addColumn}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
