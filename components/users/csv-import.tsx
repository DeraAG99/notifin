"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { Upload, CheckCircle, XCircle, Download, AlertTriangle } from "lucide-react";
import {
  type CsvRow,
  mapRawRow,
  readUserRecords,
  analyzePhone,
  fieldForHeader,
  downloadUserTemplateCsv,
  downloadUserTemplateXlsx,
} from "@/lib/users/import-columns";

interface CsvImportProps {
  onSuccess: () => void;
}

interface RowIssue {
  row: number;
  name: string;
  error: string;
}

interface ParsedFile {
  rows: CsvRow[];
  /** Phone warnings detected here, where the original cell value still exists. */
  warnings: RowIssue[];
}

interface ImportReport {
  created: number;
  updated: number;
  errors: RowIssue[];
  warnings: RowIssue[];
}

function toPayload(rows: CsvRow[]) {
  return rows
    .filter((r) => r.name?.trim())
    .map((row) => ({
      name: row.name?.trim(),
      phone: row.phone?.trim() || null,
      email: row.email?.trim() || null,
      timezone: row.timezone?.trim() || "Asia/Jakarta",
      jabatan: row.jabatan?.trim() || null,
      unitKerja: row.unitKerja?.trim() || null,
    }));
}

export function CsvImport({ onSuccess }: CsvImportProps) {
  const { t, tx } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Shared by the preview and the commit so both see identical data, and paired
   * with a phone check that runs while the original cell values are still in
   * scope -- once a row has been sent to the server there is no way to tell a
   * clean `0812...` from one Excel already stripped the leading zero of.
   */
  const readRows = async (selected: File): Promise<ParsedFile> => {
    const records = await readUserRecords(selected);
    const rows: CsvRow[] = [];
    const warnings: RowIssue[] = [];

    records.forEach((raw, index) => {
      const row = mapRawRow(raw);
      rows.push(row);
      if (!row.name?.trim()) return;

      // Look the phone back up in the original record so we can tell a
      // genuinely numeric cell from a clean text one.
      const original = Object.entries(raw).find(
        ([header, value]) =>
          fieldForHeader(header) === "phone" && value !== null && value !== undefined
      )?.[1];

      const warning = analyzePhone(original, row.phone ?? null);
      if (warning) {
        warnings.push({ row: index + 2, name: row.name.trim(), error: warning });
      }
    });

    return { rows, warnings };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);
    setReport(null);
    setPreview([]);
    setParsing(true);

    try {
      const { rows } = await readRows(selected);
      setPreview(rows.filter((r) => r.name?.trim()).slice(0, 5));
    } catch {
      setResult({ success: false, message: t.csv.readFailed });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setReport(null);

    try {
      const { rows, warnings: localWarnings } = await readRows(file);
      const validRows = toPayload(rows);

      if (validRows.length === 0) {
        setResult({ success: false, message: t.csv.noValidRows });
        setLoading(false);
        return;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRows),
      });

      const payload = await res.json();

      if (res.ok && payload.created !== undefined) {
        const created = payload.created as number;
        const updated = payload.updated as number;
        const errors = (payload.errors || []) as RowIssue[];
        const warnings = [
          ...localWarnings,
          ...((payload.warnings || []) as RowIssue[]),
        ].sort((a, b) => a.row - b.row);

        setReport({ created, updated, errors, warnings });
        setResult({
          success: errors.length === 0,
          message: tx("csv.importSummary", {
            created,
            updated,
            failed: errors.length,
          }),
        });
        onSuccess();
      } else {
        setResult({
          success: false,
          message: payload.error || payload.message || t.csv.importFailed,
        });
      }
    } catch {
      setResult({ success: false, message: t.csv.importFailed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {file ? file.name : t.csv.uploadPrompt}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{t.csv.uploadHint}</p>
        {parsing && <p className="text-xs text-primary mt-2">{t.common.loading}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadUserTemplateCsv}
        >
          <Download className="h-4 w-4" /> {t.csv.downloadTemplateCsv}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadUserTemplateXlsx}
        >
          <Download className="h-4 w-4" /> {t.csv.downloadTemplateExcel}
        </Button>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.csv.preview}</p>
          <div className="border rounded-lg overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">{t.users.form.name}</th>
                  <th className="p-2 text-left">{t.users.form.jabatan}</th>
                  <th className="p-2 text-left">{t.users.form.unitKerja}</th>
                  <th className="p-2 text-left">{t.users.form.phone}</th>
                  <th className="p-2 text-left">{t.users.form.email}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 text-muted-foreground">{row.jabatan || "—"}</td>
                    <td className="p-2 text-muted-foreground">{row.unitKerja || "—"}</td>
                    <td className="p-2">{row.phone}</td>
                    <td className="p-2">{row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            result.success
              ? "bg-emerald-400/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="text-sm">{result.message}</span>
        </div>
      )}

      {report && report.warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> {t.csv.warningsTitle}
          </p>
          <div className="border border-amber-500/40 rounded-lg overflow-auto max-h-32">
            <table className="w-full text-sm">
              <tbody>
                {report.warnings.map((w) => (
                  <tr key={`w-${w.row}`} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground align-top w-14">
                      {t.csv.rowNumber} {w.row}
                    </td>
                    <td className="p-2 align-top">{w.name || "—"}</td>
                    <td className="p-2 align-top text-amber-700 dark:text-amber-400">
                      {w.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report && report.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">{t.csv.failedRows}</p>
          <div className="border rounded-lg overflow-auto max-h-40">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left w-16">{t.csv.rowNumber}</th>
                  <th className="p-2 text-left">{t.users.form.name}</th>
                  <th className="p-2 text-left">{t.common.error}</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((err) => (
                  <tr key={`e-${err.row}`} className="border-t">
                    <td className="p-2 text-muted-foreground">{err.row}</td>
                    <td className="p-2">{err.name || "—"}</td>
                    <td className="p-2 text-destructive">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleImport} disabled={!file || loading || parsing}>
          {loading ? t.csv.importing : t.csv.importButton}
        </Button>
      </div>
    </div>
  );
}
