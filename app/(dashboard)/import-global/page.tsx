"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";
import {
  Upload,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Database,
} from "lucide-react";
import {
  parseWithType,
  detectImportType,
  detectXlsxImportType,
  type ImportTypeConfig,
} from "@/lib/imports/engine";
import type { ImportItem } from "@/lib/imports/types";

interface GlobalImportRow {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryKey: string;
  source: string;
  engine: string;
  fileName: string;
  period: string | null;
  data: ImportItem[];
  summary: { itemCount: number; pendingPerTriwulan: Record<number, number> };
  createdAt: string | null;
  updatedAt: string | null;
}

interface TableBlock {
  kegiatan: string;
  indikator: string;
  satuan: string;
  targetTahunan: string | null;
  rows: ImportItem[];
}

function buildTableBlocks(items: ImportItem[]): TableBlock[] {
  const map = new Map<string, TableBlock>();
  for (const item of items) {
    const key = `${item.intervensi}\u0000${item.indikator}`;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(item);
    } else {
      map.set(key, {
        kegiatan: item.intervensi,
        indikator: item.indikator,
        satuan: item.satuan,
        targetTahunan: item.target,
        rows: [item],
      });
    }
  }
  const blocks = Array.from(map.values());
  for (const block of blocks) {
    block.rows.sort((a, b) => a.triwulan - b.triwulan);
  }
  return blocks;
}

export default function ImportGlobalPage() {
  const { t, tx } = useI18n();

  const [imports, setImports] = useState<GlobalImportRow[]>([]);
  const [types, setTypes] = useState<ImportTypeConfig[]>([]);
  const [categories, setCategories] = useState<{ id: string; key: string; name: string }[]>([]);
  const [selectedType, setSelectedType] = useState<ImportTypeConfig | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<{ items: ImportItem[]; errors: string[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = imports.find((i) => i.id === selectedId) || null;
  const tableBlocks = selected ? buildTableBlocks(selected.data) : [];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, typesRes, catRes] = await Promise.all([
        fetch("/api/imports/global"),
        fetch("/api/imports/types"),
        fetch("/api/imports/categories"),
      ]);
      const listJson = await listRes.json();
      const typesJson = await typesRes.json();
      const catJson = await catRes.json();
      if (typesJson.success) setTypes(typesJson.data);
      if (catJson.success) {
        setCategories(
          (catJson.data as { id: string; key: string; name: string; isActive: boolean | null }[])
            .filter((c) => c.isActive !== false)
            .map((c) => ({ id: c.id, key: c.key, name: c.name }))
        );
      }
      if (listJson.success) {
        const rows = listJson.data as GlobalImportRow[];
        setImports(rows);
        setSelectedId((prev) =>
          prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id || null
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setParsing(true);
    setSelectedType(null);
    setPreview(null);
    try {
      const name = selectedFile.name.toLowerCase();
      if (name.endsWith(".html") || name.endsWith(".htm")) {
        const text = await selectedFile.text();
        const detected = detectImportType(types, text);
        if (!detected) {
          setPreview({ items: [], errors: [t.imports.detectFailed] });
        } else {
          setSelectedType(detected);
          setPreview(await parseWithType(detected, text));
        }
      } else if (name.endsWith(".xlsx")) {
        const buffer = await selectedFile.arrayBuffer();
        const XLSX = await import("xlsx");
        let headerText = "";
        try {
          const wb = XLSX.read(buffer, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (firstSheet) {
            const headerRow = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
              header: 1,
              defval: null,
            })[0] as unknown[] | undefined;
            headerText = (headerRow || []).map((c) => String(c ?? "")).join(" ");
          }
        } catch {
          // header tidak terbaca, lanjut tanpa deteksi
        }
        const detected = detectXlsxImportType(types, headerText);
        if (!detected) {
          setPreview({ items: [], errors: [t.imports.detectFailed] });
        } else {
          setSelectedType(detected);
          setPreview(await parseWithType(detected, buffer));
        }
      } else {
        setPreview({
          items: [],
          errors: ["Format file tidak didukung. Gunakan .html atau .xlsx"],
        });
      }
    } catch {
      setPreview({ items: [], errors: ["Gagal membaca file"] });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCategoryId || !selectedType || !file || !preview || preview.items.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/imports/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importTypeId: selectedType.id,
          categoryId: selectedCategoryId,
          fileName: file.name,
          items: preview.items,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t.common.success, description: result.message || "Data global berhasil diimpor", type: "success" });
        setSelectedCategoryId("");
        setFile(null);
        setPreview(null);
        setSelectedType(null);
        await fetchData();
      } else {
        toast.add({ title: t.common.error, description: result.error || "Gagal mengimpor data", type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: "Gagal mengimpor data", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: GlobalImportRow) => {
    if (!confirm(`Hapus data global "${row.categoryName}"?`)) return;
    try {
      const res = await fetch(`/api/imports/global/${row.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t.common.deleted, description: "Data global dihapus", type: "success" });
        await fetchData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            {t.importGlobal?.title || "Data Global"}
          </h1>
          <p className="text-muted-foreground">
            {t.importGlobal?.description || "Data import yang berlaku untuk semua pengguna"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t.imports.importSection}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.imports.category}</Label>
            <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v ?? "")}>
              <SelectTrigger>
                {(() => {
                  const sel = categories.find((c) => c.id === selectedCategoryId);
                  return sel ? <span>{sel.name}</span> : <SelectValue placeholder={t.imports.categoryPlaceholder} />;
                })()}
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {selectedCategoryId && (
                <p className="text-xs text-muted-foreground">{t.imports.keyHint}</p>
              )}
            </div>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {file ? file.name : t.imports.uploadPrompt}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.imports.uploadHint}</p>
          </div>

          {file && selectedType && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t.imports.detect}</span>
              <Badge variant="outline">{selectedType.name}</Badge>
            </div>
          )}

          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.common.loading}
            </div>
          )}

          {preview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {preview.items.length > 0 ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span>{tx("imports.parsedCount", { count: preview.items.length })}</span>
              </div>
              {preview.errors.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 p-3 text-xs space-y-1">
                  <div className="font-semibold">{tx("imports.parseErrors", { count: preview.errors.length })}</div>
                  <ul className="list-disc list-inside">
                    {preview.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.items.length > 0 && (
                <div className="flex items-center justify-end">
                  <Button
                    onClick={handleImport}
                    disabled={submitting || !selectedCategoryId || !selectedType}
                  >
                    {submitting ? t.imports.importing : t.imports.importButton}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t.importGlobal?.dataSection || "Data Global Tersimpan"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.common.loading}
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.importGlobal?.empty || "Belum ada data global"}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {imports.map((row) => (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      row.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{row.categoryName}</span>
                        <Badge variant="secondary" className="font-mono">{row.categoryKey}</Badge>
                        <Badge variant="outline" className="text-[10px]">{row.engine}</Badge>
                        <Badge variant="default" className="text-[10px] bg-blue-600">
                          {t.importGlobal?.badge || "Global"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {row.fileName}
                        {row.period ? ` · ${row.period}` : ""} · {tx("imports.fileInfo", { fileName: row.fileName, itemCount: row.summary.itemCount })}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[1, 2, 3, 4].map((tw) => (
                          <Badge
                            key={tw}
                            variant={row.summary.pendingPerTriwulan[tw] ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {tx("imports.tw", { tw })}: {row.summary.pendingPerTriwulan[tw] ?? 0}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(row)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {selected && (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.imports.kegiatan}</TableHead>
                        <TableHead>{t.imports.indikator}</TableHead>
                        <TableHead>{t.imports.satuan}</TableHead>
                        <TableHead>{t.imports.targetTahunan}</TableHead>
                        <TableHead>{t.imports.triwulan}</TableHead>
                        <TableHead>{t.imports.target}</TableHead>
                        <TableHead>{t.imports.realisasi}</TableHead>
                        <TableHead>{t.imports.capaian}</TableHead>
                        <TableHead>{t.imports.keterangan}</TableHead>
                        <TableHead>{t.imports.validasi}</TableHead>
                        <TableHead>{t.imports.keteranganValidasi}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableBlocks.map((block, bi) =>
                        block.rows.map((item, ri) => (
                          <TableRow key={`${bi}-${ri}`}>
                            {ri === 0 && (
                              <>
                                <TableCell rowSpan={block.rows.length} className="align-top whitespace-normal">
                                  {block.kegiatan}
                                </TableCell>
                                <TableCell rowSpan={block.rows.length} className="align-top whitespace-normal">
                                  {block.indikator}
                                </TableCell>
                                <TableCell rowSpan={block.rows.length} className="align-top whitespace-normal">
                                  {block.satuan}
                                </TableCell>
                                <TableCell rowSpan={block.rows.length} className="align-top whitespace-normal">
                                  {block.targetTahunan}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="align-top">{tx("imports.tw", { tw: item.triwulan })}</TableCell>
                            <TableCell className="align-top">{item.targetValue}</TableCell>
                            <TableCell className="align-top">{item.realisasi || " - "}</TableCell>
                            <TableCell className="align-top">{item.capaian || " - "}</TableCell>
                            <TableCell className="align-top whitespace-normal">{item.keterangan || " - "}</TableCell>
                            <TableCell className="align-top">{item.validasi || " - "}</TableCell>
                            <TableCell className="align-top whitespace-normal">{item.keteranganValidasi || " - "}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
