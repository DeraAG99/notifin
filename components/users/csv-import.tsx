"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import Papa from "papaparse";

interface CsvImportProps {
  onSuccess: () => void;
}

interface CsvRow {
  name?: string;
  phone?: string;
  email?: string;
  timezone?: string;
}

export function CsvImport({ onSuccess }: CsvImportProps) {
  const { t, tx } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5) as CsvRow[]);
      },
    });
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as CsvRow[];
        const validRows = data.filter((r) => r.name);

        try {
          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validRows.map((row) => ({
              name: row.name,
              phone: row.phone || null,
              email: row.email || null,
              timezone: row.timezone || "Asia/Jakarta",
            }))),
          });

          const data = await res.json();
          if (data.success) {
            setResult({ success: true, message: tx("csv.importSuccess", { count: validRows.length }) });
            onSuccess();
          } else {
            setResult({ success: false, message: data.error || t.csv.importFailed });
          }
        } catch {
          setResult({ success: false, message: t.csv.importFailed });
        } finally {
          setLoading(false);
        }
      },
    });
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
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {file ? file.name : t.csv.uploadPrompt}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t.csv.uploadHint}
        </p>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.csv.preview}</p>
          <div className="border rounded-lg overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">{t.users.form.name}</th>
                  <th className="p-2 text-left">{t.users.form.phone}</th>
                  <th className="p-2 text-left">{t.users.form.email}</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{row.name}</td>
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
        <div className={`flex items-center gap-2 p-3 rounded-lg ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="text-sm">{result.message}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleImport} disabled={!file || loading}>
          {loading ? t.csv.importing : t.csv.importButton}
        </Button>
      </div>
    </div>
  );
}
