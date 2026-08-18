"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Upload,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
} from "lucide-react";
import {
  parseWithType,
  detectImportType,
  detectXlsxImportType,
  type ImportTypeConfig,
} from "@/lib/imports/engine";
import type { ImportItem } from "@/lib/imports/types";
import type { User } from "@/types";

interface ImportRow {
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

interface TwBlock {
  triwulan: number;
  satuan: string;
  target: string;
  realisasi: string | null;
  validasi: string | null;
}

interface OutputRow {
  output: string;
  rencanaAksi: string;
  kriteriaKeberhasilan: string;
  tws: TwBlock[];
}

interface RaKkGroup {
  rencanaAksi: string;
  kriteriaKeberhasilan: string;
  outputs: OutputRow[];
}

interface IntervensiBlock {
  intervensi: string;
  rencanaHasilKerja: string;
  indikator: string;
  kodeSumber: string | null;
  target: string | null;
  rakk: RaKkGroup[];
}

function buildPivot(items: ImportItem[]): IntervensiBlock[] {
  const groups = new Map<string, ImportItem[]>();
  for (const item of items) {
    const key = `${item.intervensi}\u0000${item.rencanaHasilKerja}\u0000${item.indikator}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const blocks: IntervensiBlock[] = [];

  for (const list of groups.values()) {
    const outputMap = new Map<string, OutputRow>();
    for (const item of list) {
      const tw: TwBlock = {
        triwulan: item.triwulan,
        satuan: item.satuan,
        target: item.targetValue,
        realisasi: item.realisasi,
        validasi: item.validasi,
      };
      const existing = outputMap.get(item.output);
      if (existing) {
        existing.tws.push(tw);
      } else {
        outputMap.set(item.output, {
          output: item.output,
          rencanaAksi: item.rencanaAksi,
          kriteriaKeberhasilan: item.kriteriaKeberhasilan,
          tws: [tw],
        });
      }
    }

    const outputs = Array.from(outputMap.values());
    for (const output of outputs) {
      output.tws.sort((a, b) => a.triwulan - b.triwulan);
    }

    const rakk: RaKkGroup[] = [];
    for (const output of outputs) {
      const last = rakk[rakk.length - 1];
      if (
        last &&
        last.rencanaAksi === output.rencanaAksi &&
        last.kriteriaKeberhasilan === output.kriteriaKeberhasilan
      ) {
        last.outputs.push(output);
      } else {
        rakk.push({
          rencanaAksi: output.rencanaAksi,
          kriteriaKeberhasilan: output.kriteriaKeberhasilan,
          outputs: [output],
        });
      }
    }

    const first = list[0];
    blocks.push({
      intervensi: first.intervensi,
      rencanaHasilKerja: first.rencanaHasilKerja,
      indikator: first.indikator,
      kodeSumber: first.kodeSumber,
      target: first.target,
      rakk,
    });
  }

  return blocks;
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

export default function UserImportsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, tx } = useI18n();
  const userId = String(params.id || "");

  const [user, setUser] = useState<User | null>(null);
  const [imports, setImports] = useState<ImportRow[]>([]);
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
  const isTable = selected?.engine === "table" || selected?.engine === "pdukpdxlsx";
  const blocks = !isTable && selected ? buildPivot(selected.data) : [];
  const tableBlocks = selected ? buildTableBlocks(selected.data) : [];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, listRes, typesRes, catRes] = await Promise.all([
        fetch(`/api/users/${userId}`),
        fetch(`/api/users/${userId}/imports`),
        fetch("/api/imports/types"),
        fetch("/api/imports/categories"),
      ]);
      const userData = await userRes.json();
      const listJson = await listRes.json();
      const typesJson = await typesRes.json();
      const catJson = await catRes.json();
      if (userData.success) setUser(userData.data);
      if (typesJson.success) setTypes(typesJson.data);

      if (catJson.success) {
        setCategories(
          (catJson.data as { id: string; key: string; name: string; isActive: boolean | null }[])
            .filter((c) => c.isActive !== false)
            .map((c) => ({ id: c.id, key: c.key, name: c.name }))
        );
      }

      if (listJson.success) {
        const rows = listJson.data as ImportRow[];
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
    if (userId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
      const res = await fetch(`/api/users/${userId}/imports`, {
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
        toast.add({ title: t.common.success, description: result.message || t.imports.importSuccess, type: "success" });
        setSelectedCategoryId("");
        setFile(null);
        setPreview(null);
        setSelectedType(null);
        await fetchData();
      } else {
        toast.add({ title: t.common.error, description: result.error || t.imports.importFailed, type: "error" });
      }
    } catch {
      toast.add({ title: t.common.error, description: t.imports.importFailed, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: ImportRow) => {
    if (!confirm(`Hapus data import "${row.categoryName}"?`)) return;
    try {
      const res = await fetch(`/api/users/${userId}/imports/${row.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.add({ title: t.common.deleted, description: "Data import dihapus", type: "success" });
        await fetchData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {tx("imports.title", { name: user?.name || "..." })}
          </h1>
          <p className="text-muted-foreground">{user?.email || user?.phone || ""}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/import-types")}>
          <Database className="h-4 w-4 mr-2" /> {t.importTypes.title}
        </Button>
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
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-6 px-0 text-xs"
                onClick={() => router.push("/import-categories")}
              >
                {t.imports.createCategory}
              </Button>
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
            {t.imports.dataSection}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.common.loading}
            </div>
          ) : imports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t.imports.noImport}</div>
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

              {selected && (isTable ? (
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
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">{t.imports.table.colNo}</TableHead>
                        <TableHead>{t.imports.table.colIntervensi}</TableHead>
                        <TableHead>{t.imports.table.colRhk}</TableHead>
                        <TableHead>{t.imports.table.colIndikator}</TableHead>
                        <TableHead>{t.imports.table.colTarget}</TableHead>
                        <TableHead>{t.imports.table.colRencanaAksi}</TableHead>
                        <TableHead>{t.imports.table.colKriteria}</TableHead>
                        <TableHead>{t.imports.table.colOutput}</TableHead>
                        <TableHead>{t.imports.table.colTwTarget}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blocks.map((block, bi) => {
                        const totalRows = block.rakk.reduce(
                          (sum, g) => sum + g.outputs.length,
                          0
                        );
                        return block.rakk.map((group, gi) =>
                          group.outputs.map((output, oi) => {
                            const isFirstRowOfBlock = gi === 0 && oi === 0;
                            const isFirstOfGroup = oi === 0;
                            return (
                              <TableRow key={`${bi}-${gi}-${oi}`}>
                                {isFirstRowOfBlock && (
                                  <>
                                    <TableCell rowSpan={totalRows} className="text-center align-top">
                                      {bi + 1}
                                    </TableCell>
                                    <TableCell rowSpan={totalRows} className="align-top whitespace-normal">
                                      {block.intervensi}
                                    </TableCell>
                                    <TableCell rowSpan={totalRows} className="align-top whitespace-normal">
                                      {block.rencanaHasilKerja}
                                    </TableCell>
                                    <TableCell rowSpan={totalRows} className="align-top whitespace-normal">
                                      <div className="flex flex-col gap-1">
                                        <Badge
                                          variant={block.kodeSumber === "iku" ? "default" : "secondary"}
                                          className="w-fit"
                                        >
                                          {block.kodeSumber === "iku"
                                            ? t.imports.table.kodeIku
                                            : t.imports.table.kodeLainnya}
                                        </Badge>
                                        <span>{block.indikator}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell rowSpan={totalRows} className="align-top whitespace-normal">
                                      {block.target}
                                    </TableCell>
                                  </>
                                )}
                                {isFirstOfGroup && (
                                  <>
                                    <TableCell rowSpan={group.outputs.length} className="align-top whitespace-normal">
                                      {group.rencanaAksi}
                                    </TableCell>
                                    <TableCell rowSpan={group.outputs.length} className="align-top whitespace-normal">
                                      {group.kriteriaKeberhasilan}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell className="align-top whitespace-normal">{output.output}</TableCell>
                                <TableCell className="align-top">
                                  <div className="space-y-1">
                                    {output.tws.map((tw, ti) => (
                                      <div
                                        key={ti}
                                        className={`rounded border p-2 text-xs ${
                                          tw.realisasi ? "border-emerald-500/30 bg-emerald-500/10" : ""
                                        }`}
                                      >
                                        <div className="font-semibold">
                                          {tx("imports.tw", { tw: tw.triwulan })}
                                        </div>
                                        <div className="text-muted-foreground">
                                          {t.imports.target}:{" "}
                                          <span className="text-foreground">
                                            {tw.target} {tw.satuan}
                                          </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {t.imports.realisasi}:{" "}
                                          <span className="text-foreground">
                                            {tw.realisasi || " - "}
                                          </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {t.imports.validasi}:{" "}
                                          <span className="text-foreground">
                                            {tw.validasi || " - "}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
