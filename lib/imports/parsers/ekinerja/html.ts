import type { ImportParser, ParseResult, ImportItem } from "../../types";

interface CellRow {
  "row-0"?: string;
  "row-1"?: string;
  "row-2"?: string;
  "row-3"?: string | number;
  "row-4"?: string;
  "row-5"?: string;
  "row-6"?: string;
  "row-7"?: string;
  "row-8"?: string;
}

interface TwTarget {
  tw?: string | number;
  satuan?: string;
  target?: string | number;
  realisasi?: string | number | null;
  validasi?: string | number | null;
}

function safeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function toNullableStr(value: unknown): string | null {
  const s = str(value);
  if (s === null || s === "-" || s === "--") return null;
  return s;
}

const CELL_REGEX = /class="text-right">\s*(\{[\s\S]*?\})\s*<\/td>/g;

export const ekinerjaHtmlParser: ImportParser = {
  format: "html",

  parse(content: string | ArrayBuffer): Promise<ParseResult> {
    const errors: string[] = [];
    const items: ImportItem[] = [];

    const html = typeof content === "string" ? content : Buffer.from(content).toString("utf-8");

    let match: RegExpExecArray | null;
    let cellIndex = 0;

    while ((match = CELL_REGEX.exec(html)) !== null) {
      cellIndex += 1;
      const cell = safeJson<CellRow>(match[1]);
      if (!cell) {
        errors.push(`Baris ${cellIndex}: JSON sel tidak valid`);
        continue;
      }

      const intervensi = safeJson<{ intervensi?: string }>(cell["row-0"] || "{}");
      const rhk = safeJson<{ rencana_hasil_kerja?: string }>(cell["row-1"] || "{}");
      const indikator = safeJson<{ indikator?: string; kode_sumber?: string }>(cell["row-2"] || "{}");
      const rencanaAksi = str(cell["row-4"]);
      const kriteriaKeberhasilan = str(cell["row-5"]);
      const output = str(cell["row-6"]);

      const targets = safeJson<TwTarget[]>(cell["row-7"] || "[]");
      const twList = Array.isArray(targets) ? targets : [];

      if (twList.length === 0) {
        errors.push(`Baris ${cellIndex}: tidak ada data triwulan`);
        continue;
      }

      for (const tw of twList) {
        const triwulan = Number(tw.tw);
        if (!Number.isInteger(triwulan) || triwulan < 1 || triwulan > 4) {
          errors.push(`Baris ${cellIndex}: triwulan tidak valid (${tw.tw})`);
          continue;
        }

        items.push({
          intervensi: intervensi?.intervensi || "",
          rencanaHasilKerja: rhk?.rencana_hasil_kerja || "",
          indikator: indikator?.indikator || "",
          kodeSumber: indikator?.kode_sumber || null,
          target: str(cell["row-3"]),
          rencanaAksi: rencanaAksi || "",
          kriteriaKeberhasilan: kriteriaKeberhasilan || "",
          output: output || "",
          triwulan,
          satuan: str(tw.satuan) || "",
          targetValue: str(tw.target) || "",
          realisasi: toNullableStr(tw.realisasi),
          validasi: toNullableStr(tw.validasi),
          konsolidasi: null,
          polarisasi: null,
          capaian: null,
          keterangan: null,
          keteranganValidasi: null,
        });
      }
    }

    if (items.length === 0 && errors.length === 0) {
      errors.push(
        "Tidak ditemukan data. Pastikan file adalah export 'Data Kinerja Saya' dari e-TPP / E-Kinerja."
      );
    }

    return Promise.resolve({ items, errors });
  },
};
