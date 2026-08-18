import type { ImportParser, ParseResult, ImportItem } from "../types";
import type * as XLSXType from "xlsx";

function toCamelCase(text: string): string {
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "";
  return words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

interface TwColumnSet {
  triwulan: number;
  target: number | null;
  realisasi: number | null;
  capaian: number | null;
  validasi: number | null;
}

export const pdukpdxlsxParser: ImportParser = {
  format: "xlsx",

  parse(content: string | ArrayBuffer): Promise<ParseResult> {
    const errors: string[] = [];

    return (async () => {
      const XLSX = await import("xlsx");
      let workbook: XLSXType.WorkBook;
      try {
        workbook = XLSX.read(content, { type: "array" });
      } catch {
        return { items: [], errors: ["File Excel tidak dapat dibaca"] };
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { items: [], errors: ["File Excel kosong (tidak ada sheet)"] };
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(
        workbook.Sheets[sheetName],
        { header: 1, defval: null }
      ) as unknown[][];

      if (rows.length < 2) {
        return { items: [], errors: ["File Excel tidak memiliki baris data"] };
      }

      const headerRow = rows[0] as unknown[];
      const headers = headerRow.map((h) => str(h) || "");

      const findCol = (patterns: RegExp[]): number | null => {
        for (let i = 0; i < headers.length; i++) {
          const n = headers[i].toLowerCase();
          if (!n) continue;
          for (const p of patterns) {
            if (p.test(n)) return i;
          }
        }
        return null;
      };

      const colProgram = findCol([/nama program/]);
      const colKegiatan = findCol([/nama kegiatan/]);
      const colSubKegiatan = findCol([/nama sub kegiatan/]);
      const colIndikator = findCol([/^indikator$/]);
      const colSatuan = findCol([/^satuan$/]);
      const colTargetTahunan = findCol([/target tahunan/]);
      const colPolarisasi = findCol([/polarisasi/]);
      const colKonsolidasi = findCol([/konsolidasi/]);

      const twSets = new Map<number, TwColumnSet>();
      for (let i = 0; i < headers.length; i++) {
        const n = headers[i].toLowerCase();
        const twMatch = n.match(/tw\s*(\d)/);
        if (!twMatch) continue;
        const tw = Number(twMatch[1]);
        if (tw < 1 || tw > 4) continue;

        const entry =
          twSets.get(tw) ||
          ({
            triwulan: tw,
            target: null,
            realisasi: null,
            capaian: null,
            validasi: null,
          } as TwColumnSet);

        if (/target\s+kalkulasi\s+tw/.test(n) && !/prev/.test(n)) {
          entry.target = i;
        } else if (/status\s+validasi/.test(n)) {
          entry.validasi = i;
        } else if (/realisasi/.test(n)) {
          entry.realisasi = i;
        } else if (/capaian/.test(n)) {
          entry.capaian = i;
        }

        twSets.set(tw, entry);
      }

      if (twSets.size === 0) {
        return {
          items: [],
          errors: [
            "Kolom triwulan (Target Kalkulasi TW / Capaian TW) tidak ditemukan.",
          ],
        };
      }

      const rawKeys: string[] = [];
      const usedKeys = new Map<string, number>();
      for (const h of headers) {
        let key = toCamelCase(h);
        if (!key) key = "kolom";
        const count = usedKeys.get(key) || 0;
        usedKeys.set(key, count + 1);
        rawKeys.push(count > 0 ? `${key}${count + 1}` : key);
      }

      const items: ImportItem[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const hasData = row.some(
          (c) => c !== null && String(c).trim() !== ""
        );
        if (!hasData) continue;

        const namaKegiatan =
          colKegiatan !== null ? str(row[colKegiatan]) || "" : "";
        const namaSubKegiatan =
          colSubKegiatan !== null ? str(row[colSubKegiatan]) || "" : "";
        const namaProgram =
          colProgram !== null ? str(row[colProgram]) || "" : "";
        const indikator =
          colIndikator !== null ? str(row[colIndikator]) || "" : "";
        const satuan = colSatuan !== null ? str(row[colSatuan]) || "" : "";
        const targetTahunan =
          colTargetTahunan !== null ? str(row[colTargetTahunan]) : null;
        const polarisasi =
          colPolarisasi !== null ? str(row[colPolarisasi]) : null;
        const konsolidasi =
          colKonsolidasi !== null ? str(row[colKonsolidasi]) : null;

        const raw: Record<string, string | null> = {};
        for (let c = 0; c < headers.length; c++) {
          if (rawKeys[c]) {
            raw[rawKeys[c]] = str(row[c]);
          }
        }

        for (const [, twCols] of twSets) {
          const targetValue =
            twCols.target !== null ? str(row[twCols.target]) : null;
          if (targetValue === null) continue;

          items.push({
            intervensi: namaSubKegiatan || namaKegiatan,
            rencanaHasilKerja: namaProgram,
            indikator,
            kodeSumber: null,
            target: targetTahunan,
            rencanaAksi: "",
            kriteriaKeberhasilan: "",
            output: namaSubKegiatan || namaKegiatan,
            triwulan: twCols.triwulan,
            satuan,
            targetValue,
            realisasi:
              twCols.realisasi !== null ? str(row[twCols.realisasi]) : null,
            capaian:
              twCols.capaian !== null ? str(row[twCols.capaian]) : null,
            validasi:
              twCols.validasi !== null ? str(row[twCols.validasi]) : null,
            konsolidasi,
            polarisasi,
            keterangan: null,
            keteranganValidasi: null,
            raw,
          });
        }
      }

      if (items.length === 0 && errors.length === 0) {
        errors.push("Tidak ada baris data yang dikenali di sheet pertama.");
      }

      return { items, errors };
    })();
  },
};
