import type { ImportItem, ParseResult } from "../types";
import { cleanCellText, nullableStr, trimStr } from "../utils";

export type MappingField =
  | "kegiatan"
  | "indikator"
  | "satuan"
  | "konsolidasi"
  | "polarisasi"
  | "targetTahunan"
  | "triwulan"
  | "target"
  | "realisasi"
  | "capaian"
  | "keterangan"
  | "validasi"
  | "keteranganValidasi";

export interface ColumnRule {
  field: MappingField;
  match: string;
  mode: "exact" | "contains" | "contains-exclude";
  exclude?: string;
}

export interface TableMapping {
  headerRow: string[];
  columns: ColumnRule[];
  triwulanRegex: string;
}

interface MappedItem {
  kegiatan: string;
  indikator: string;
  satuan: string;
  konsolidasi: string | null;
  polarisasi: string | null;
  targetTahunan: string | null;
  triwulan: number | null;
  target: string | null;
  realisasi: string | null;
  capaian: string | null;
  keterangan: string | null;
  validasi: string | null;
  keteranganValidasi: string | null;
}

function toImportItem(m: MappedItem): ImportItem {
  return {
    intervensi: m.kegiatan || m.indikator || "",
    rencanaHasilKerja: m.kegiatan || "",
    indikator: m.indikator,
    kodeSumber: null,
    target: m.targetTahunan,
    rencanaAksi: "",
    kriteriaKeberhasilan: "",
    output: m.indikator ? `${m.kegiatan} - ${m.indikator}` : m.kegiatan,
    triwulan: m.triwulan ?? 0,
    satuan: m.satuan,
    targetValue: m.target || "",
    realisasi: m.realisasi,
    validasi: m.validasi,
    konsolidasi: m.konsolidasi,
    polarisasi: m.polarisasi,
    capaian: m.capaian,
    keterangan: m.keterangan,
    keteranganValidasi: m.keteranganValidasi,
  };
}

function matchHeader(header: string, rule: ColumnRule): boolean {
  const n = header.toLowerCase().trim();
  if (rule.mode === "exact") return n === rule.match.toLowerCase();
  if (rule.mode === "contains-exclude") {
    return (
      n.includes(rule.match.toLowerCase()) &&
      !(rule.exclude && n.includes(rule.exclude.toLowerCase()))
    );
  }
  return n.includes(rule.match.toLowerCase());
}

export async function parseTable(
  content: string | ArrayBuffer,
  mapping: TableMapping
): Promise<ParseResult> {
  const errors: string[] = [];
  const items: ImportItem[] = [];

  const html =
    typeof content === "string" ? content : Buffer.from(content).toString("utf-8");

  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
  let tr: RegExpExecArray | null;
  while ((tr = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const localCell = new RegExp(cellRegex.source, "g");
    let td: RegExpExecArray | null;
    while ((td = localCell.exec(tr[1])) !== null) {
      cells.push(cleanCellText(td[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }

  if (rows.length < 2) {
    return { items: [], errors: ["Struktur tabel tidak ditemukan."] };
  }

  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join(" | ").toLowerCase();
    const ok = mapping.headerRow.every((k) => joined.includes(k.toLowerCase()));
    if (ok) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    return { items: [], errors: ["Baris header tidak dikenali."] };
  }

  const headers = rows[headerIndex].map((h) => h.trim());

  const columnIndex = new Map<MappingField, number>();
  for (const rule of mapping.columns) {
    if (columnIndex.has(rule.field)) continue;
    const idx = headers.findIndex((h) => matchHeader(h, rule));
    if (idx !== -1) columnIndex.set(rule.field, idx);
  }

  const triwulanIndex = columnIndex.get("triwulan");
  if (triwulanIndex === undefined) {
    return { items: [], errors: ["Kolom 'triwulan' tidak ditemukan di mapping."] };
  }

  const twRegex = new RegExp(mapping.triwulanRegex, "i");

  let ctx: MappedItem = {
    kegiatan: "",
    indikator: "",
    satuan: "",
    konsolidasi: null,
    polarisasi: null,
    targetTahunan: null,
    triwulan: null,
    target: null,
    realisasi: null,
    capaian: null,
    keterangan: null,
    validasi: null,
    keteranganValidasi: null,
  };

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    const twPos = r.findIndex((c) => twRegex.test(c));
    if (twPos === -1) continue;

    const isFull = twPos === triwulanIndex;
    const cell = (headerIdx: number): string => {
      if (isFull) return headerIdx < r.length ? r[headerIdx] : "";
      const idx = twPos + (headerIdx - triwulanIndex);
      return idx >= 0 && idx < r.length ? r[idx] : "";
    };

    const take = (field: MappingField) => {
      const idx = columnIndex.get(field);
      if (idx === undefined) return "";
      return cell(idx);
    };

    const kegiatan = trimStr(take("kegiatan"));
    if (kegiatan) ctx.kegiatan = kegiatan;
    const indikator = trimStr(take("indikator"));
    if (indikator) ctx.indikator = indikator;
    const satuan = trimStr(take("satuan"));
    if (satuan) ctx.satuan = satuan;
    const konsolidasi = trimStr(take("konsolidasi"));
    if (konsolidasi) ctx.konsolidasi = konsolidasi;
    const polarisasi = trimStr(take("polarisasi"));
    if (polarisasi) ctx.polarisasi = polarisasi;
    const targetTahunan = trimStr(take("targetTahunan"));
    if (targetTahunan) ctx.targetTahunan = targetTahunan;

    const twText = take("triwulan");
    const twMatch = twText.match(/tw\s*(\d)/i) || twText.match(/tw\s*(iv|i{1,3})/i);
    let triwulan: number | null = null;
    if (twMatch) {
      const num = Number(twMatch[1]);
      if (!Number.isNaN(num)) triwulan = num;
      else {
        const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
        triwulan = roman[twMatch[1].toLowerCase()] ?? null;
      }
    }
    if (triwulan === null || triwulan < 1 || triwulan > 4) continue;

    const target = trimStr(take("target"));
    if (target === null) continue;

    items.push(
      toImportItem({
        kegiatan: ctx.kegiatan,
        indikator: ctx.indikator,
        satuan: ctx.satuan,
        konsolidasi: ctx.konsolidasi,
        polarisasi: ctx.polarisasi,
        targetTahunan: ctx.targetTahunan,
        triwulan,
        target,
        realisasi: nullableStr(take("realisasi") || null),
        capaian: nullableStr(take("capaian") || null),
        keterangan: trimStr(take("keterangan")),
        validasi: nullableStr(take("validasi") || null),
        keteranganValidasi: trimStr(take("keteranganValidasi")),
      })
    );
  }

  if (items.length === 0 && errors.length === 0) {
    errors.push("Tidak ada baris data yang dikenali.");
  }

  return { items, errors };
}
