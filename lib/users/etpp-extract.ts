import type { ImportItem } from "../imports/types";

export interface EtppMetadata {
  etpp_imported: true;
  bulan_ini: string;
  triwulan_ini: number;
  /** `rencanaHasilKerja` for rows whose `kodeSumber` is `other`. */
  rhk_lainnya: string[];
  /** `rencanaHasilKerja` for rows whose `kodeSumber` is `iku`. */
  rhk_iku: string[];
  /** `rencanaAksi` across every row, IKU and Lainnya combined, so the message can number them continuously. */
  ra: string[];
  last_import: string;
  // Spreads into `users.metadata` (jsonb) and merges with unrelated keys.
  [key: string]: unknown;
}

/**
 * e-TPP writes the origin of a target row into `indikator.kode_sumber` as a
 * lowercase token, not a human label: `"iku"` or `"other"`. The real exports
 * only ever use those two, so match them exactly instead of guessing from
 * substrings -- an earlier version treated `""` as IKU, which silently sent the
 * wrong bucket whenever the field was missing.
 */
function isIku(item: ImportItem): boolean {
  return (item.kodeSumber || "").trim().toLowerCase() === "iku";
}

function pushUnique(target: string[], seen: Set<string>, value: string | null | undefined): void {
  // e-TPP stores these cells as multi-line text, so the raw value carries
  // embedded newlines. Left alone they render as ragged gaps inside a
  // numbered list in WhatsApp, which reads as broken formatting.
  const v = (value || "").replace(/\s+/g, " ").trim();
  if (!v || seen.has(v)) return;
  seen.add(v);
  target.push(v);
}

/**
 * Flattens an e-TPP "Data Kinerja Saya" import into the metadata that the
 * notification templates render.
 *
 * Only the target table and the profile header survive in that export. Dialog
 * Kinerja, Penilaian Perilaku, and e-Monev are separate pages in the e-TPP app
 * and are not present in the saved HTML, so nothing here can fill them.
 */
export function extractEtppMetadata(items: ImportItem[], importDate = new Date()): EtppMetadata {
  const bulanIni = importDate.toLocaleString("id-ID", { month: "long", year: "numeric" });
  const triwulanIni = Math.ceil((importDate.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;

  const rhkIku: string[] = [];
  const rhkLainnya: string[] = [];
  const ra: string[] = [];
  const seenIku = new Set<string>();
  const seenLainnya = new Set<string>();
  const seenRa = new Set<string>();

  for (const item of items) {
    const hasilKerja = item.rencanaHasilKerja || "";
    if (isIku(item)) {
      pushUnique(rhkIku, seenIku, hasilKerja);
    } else {
      pushUnique(rhkLainnya, seenLainnya, hasilKerja);
    }
    pushUnique(ra, seenRa, item.rencanaAksi);
  }

  return {
    etpp_imported: true,
    bulan_ini: bulanIni,
    triwulan_ini: triwulanIni,
    rhk_iku: rhkIku,
    rhk_lainnya: rhkLainnya,
    ra,
    last_import: importDate.toISOString(),
  };
}
