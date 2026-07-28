"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
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
            setResult({ success: true, message: `${validRows.length} pengguna berhasil diimpor` });
            onSuccess();
          } else {
            setResult({ success: false, message: data.error || "Gagal mengimpor" });
          }
        } catch (error) {
          setResult({ success: false, message: "Gagal mengimpor" });
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
          {file ? file.name : "Klik untuk mengunggah file CSV"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          CSV harus memiliki kolom: name, phone, email, timezone
        </p>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Preview (5 baris pertama):</p>
          <div className="border rounded-lg overflow-auto max-h-48">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Nama</th>
                  <th className="p-2 text-left">Telepon</th>
                  <th className="p-2 text-left">Email</th>
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
          {loading ? "Mengimpor..." : "Impor Pengguna"}
        </Button>
      </div>
    </div>
  );
}
