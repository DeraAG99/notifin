import { db } from "@/lib/db";
import { importTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TableMapping } from "./engines/table";

export const monevTableMapping: TableMapping = {
  headerRow: ["Indikator Kinerja", "Triwulan"],
  columns: [
    { field: "kegiatan", match: "kegiatan", mode: "contains" },
    { field: "indikator", match: "indikator", mode: "contains" },
    { field: "satuan", match: "satuan", mode: "exact" },
    { field: "konsolidasi", match: "konsolidasi", mode: "contains" },
    { field: "polarisasi", match: "polarisasi", mode: "contains" },
    { field: "targetTahunan", match: "target tahunan", mode: "contains" },
    { field: "triwulan", match: "triwulan", mode: "exact" },
    { field: "target", match: "target", mode: "exact" },
    { field: "realisasi", match: "realisasi", mode: "exact" },
    { field: "capaian", match: "capaian", mode: "contains" },
    {
      field: "keterangan",
      match: "keterangan",
      mode: "contains-exclude",
      exclude: "keterangan validasi",
    },
    { field: "validasi", match: "validasi", mode: "exact" },
    { field: "keteranganValidasi", match: "keterangan validasi", mode: "exact" },
  ],
  triwulanRegex: "tw\\s*(?:iv|[1-4]|i{1,3})",
};

export interface ImportTypeTemplate {
  key: string;
  name: string;
  engine: string;
  format: string;
  detectRules: string[];
  columnMapping: Record<string, unknown> | null;
}

export const importTypeTemplates: ImportTypeTemplate[] = [
  {
    key: "ekinerja",
    name: "Data Kinerja (e-TPP)",
    engine: "ekinerja-json",
    format: "html",
    detectRules: ['"row-0"', "text-right"],
    columnMapping: null,
  },
  {
    key: "monev",
    name: "Monev (Kegiatan / Sub Kegiatan Renstra)",
    engine: "table",
    format: "html",
    detectRules: ["Indikator Kinerja", "Triwulan", "Target Tahunan"],
    columnMapping: monevTableMapping as unknown as Record<string, unknown>,
  },
  {
    key: "pdukpdxlsx",
    name: "PDUKPD (Kegiatan / Sub Kegiatan)",
    engine: "pdukpdxlsx",
    format: "xlsx",
    detectRules: ["target kalkulasi tw"],
    columnMapping: null,
  },
];

export async function ensureSeedImportTypes(adminId: string): Promise<void> {
  const existing = await db
    .select({ key: importTypes.key })
    .from(importTypes)
    .where(eq(importTypes.adminId, adminId));

  const existingKeys = new Set(existing.map((e) => e.key));
  const missing = importTypeTemplates.filter((t) => !existingKeys.has(t.key));

  if (missing.length === 0) return;

  await db.insert(importTypes).values(
    missing.map((t) => ({ ...t, adminId }))
  );
}
