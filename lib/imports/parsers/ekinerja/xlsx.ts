import type { ImportParser, ParseResult, ImportItem } from "../../types";
import type * as XLSXType from "xlsx";

interface HeaderMap {
  index: number;
  text: string;
}

function normalizeHeader(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
}

function firstMatch(headers: HeaderMap[], patterns: RegExp[]): number | null {
  for (const h of headers) {
    const n = normalizeHeader(h.text);
    if (!n) continue;
    for (const p of patterns) {
      if (p.test(n)) return h.index;
    }
  }
  return null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function toNullableStr(value: unknown): string | null {
  const s = str(value);
  if (s === null || s === "-" || s === "--" || s === "0") return null;
  return s;
}

function parseTwGroup(
  row: unknown[],
  triwulan: number,
  satuanCol: number | null,
  targetCol: number | null,
  realisasiCol: number | null,
  validasiCol: number | null
): ImportItem | null {
  if (targetCol === null) return null;
  const targetValue = str(row[targetCol]);
  if (targetValue === null) return null;

  return {
    intervensi: "",
    rencanaHasilKerja: "",
    indikator: "",
    kodeSumber: null,
    target: null,
    rencanaAksi: "",
    kriteriaKeberhasilan: "",
    output: "",
    triwulan,
    satuan: satuanCol !== null ? str(row[satuanCol]) || "" : "",
    targetValue,
    realisasi: realisasiCol !== null ? toNullableStr(row[realisasiCol]) : null,
    validasi: validasiCol !== null ? toNullableStr(row[validasiCol]) : null,
    konsolidasi: null,
    polarisasi: null,
    capaian: null,
    keterangan: null,
    keteranganValidasi: null,
  };
}

export const ekinerjaXlsxParser: ImportParser = {
  format: "xlsx",

  parse(content: string | ArrayBuffer): Promise<ParseResult> {
    const errors: string[] = [];

    return (async () => {
      const XLSX = await import("xlsx");
      let workbook: XLSXType.WorkBook;
      try {
        workbook = XLSX.read(content, { type: "array" });
      } catch {
        return {
          items: [],
          errors: ["File Excel tidak dapat dibaca"],
        };
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { items: [], errors: ["File Excel kosong (tidak ada sheet)"] };
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        defval: null,
      }) as unknown[][];

      let headerRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const joined = rows[i]
          .map((c) => normalizeHeader(String(c ?? "")))
          .join(" ");
        if (joined.includes("output") && joined.includes("rencana aksi")) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return {
          items: [],
          errors: [
            "Struktur tabel tidak dikenali (cari baris header yang berisi 'Output' dan 'Rencana Aksi').",
          ],
        };
      }

      const headers: HeaderMap[] = (rows[headerRowIndex] as unknown[])
        .map((h, index) => ({ index, text: String(h ?? "") }))
        .filter((h) => normalizeHeader(h.text).length > 0);

      const colIntervensi = firstMatch(headers, [/intervensi/]);
      const colRhk = firstMatch(headers, [/rencana hasil kerja/]);
      const colIndikator = firstMatch(headers, [/^indikator$/]);
      const colRencanaAksi = firstMatch(headers, [/rencana aksi/]);
      const colKriteria = firstMatch(headers, [/kriteria keberhasilan/]);
      const colOutput = firstMatch(headers, [/^output$/]);

      // Indikator target = "Target" column that appears before the first triwulan block
      const firstTwHeaderIndex = headers.find((h) => /triwulan|tw \d|trw/.test(normalizeHeader(h.text)))?.index ?? Number.MAX_SAFE_INTEGER;
      const colTargetIndikator = firstMatch(
        headers.filter((h) => h.index < firstTwHeaderIndex),
        [/^target$/]
      );

      // Triwulan columns: group headers like "Triwulan 1 - Target", "TW1 Realisasi", etc.
      const twColumns = new Map<
        number,
        { satuan: number | null; target: number | null; realisasi: number | null; validasi: number | null }
      >();
      const colSatuan = new Map<number, number>();

      for (const h of headers) {
        const n = normalizeHeader(h.text);
        const twMatch = n.match(/(?:triwulan|tw)\s*(\d)/);
        if (twMatch) {
          const tw = Number(twMatch[1]);
          const entry = twColumns.get(tw) || { satuan: null, target: null, realisasi: null, validasi: null };
          if (/satuan/.test(n)) entry.satuan = h.index;
          if (/target/.test(n)) entry.target = h.index;
          if (/realisasi/.test(n)) entry.realisasi = h.index;
          if (/validasi/.test(n)) entry.validasi = h.index;
          twColumns.set(tw, entry);
          if (/satuan/.test(n)) colSatuan.set(tw, h.index);
        }
      }

      if (twColumns.size === 0) {
        return {
          items: [],
          errors: [
            "Kolom triwulan (Target/Realisasi/Validasi per Triwulan) tidak ditemukan.",
          ],
        };
      }

      const items: ImportItem[] = [];

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const output = colOutput !== null ? str(row[colOutput]) : null;
        const hasData = row.some((c) => c !== null && String(c).trim() !== "");

        if (!hasData || (output === null && colOutput !== null && colRencanaAksi !== null && !str(row[colRencanaAksi]))) {
          continue;
        }

        for (const [tw, cols] of twColumns) {
          const item = parseTwGroup(
            row,
            tw,
            cols.satuan,
            cols.target,
            cols.realisasi,
            cols.validasi
          );
          if (!item) continue;

          item.output = output || "";
          item.intervensi = colIntervensi !== null ? str(row[colIntervensi]) || "" : "";
          item.rencanaHasilKerja = colRhk !== null ? str(row[colRhk]) || "" : "";
          item.indikator = colIndikator !== null ? str(row[colIndikator]) || "" : "";
          item.rencanaAksi = colRencanaAksi !== null ? str(row[colRencanaAksi]) || "" : "";
          item.kriteriaKeberhasilan = colKriteria !== null ? str(row[colKriteria]) || "" : "";
          item.target = colTargetIndikator !== null ? str(row[colTargetIndikator]) : null;

          items.push(item);
        }
      }

      if (items.length === 0 && errors.length === 0) {
        errors.push("Tidak ada baris data yang dikenali di sheet pertama.");
      }

      return { items, errors };
    })();
  },
};
