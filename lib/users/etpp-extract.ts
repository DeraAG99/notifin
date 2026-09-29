import type { ImportItem } from "../imports/types";

/**
 * Rencana Aksi grouped under the Rencana Hasil Kerja it belongs to.
 *
 * Nested, not flat. The message shows each RHK once as a bullet with its
 * actions indented beneath it, which a flat `[{rhk, aksi}]` cannot express --
 * the RHK would repeat once per action and the layout collapses back into the
 * flat variant this shape was chosen to avoid.
 */
export interface EtppRencanaAksi {
  rhk: string;
  aksi: string[];
}

export interface EtppMetadata {
  etpp_imported: true;
  /** `rencanaHasilKerja` for rows whose `indikator.kode_sumber` is `iku`. */
  rhk_iku: string[];
  /** `rencanaHasilKerja` for rows whose `indikator.kode_sumber` is `other`. */
  rhk_lainnya: string[];
  /** `rencanaAksi` nested under their parent RHK, IKU and Lainnya combined. */
  ra: EtppRencanaAksi[];
  last_import: string;
  // Spreads into `users.metadata` (jsonb) and merges with unrelated keys.
  [key: string]: unknown;
}

export interface EtppExtraction {
  metadata: EtppMetadata;
  /**
   * Rows dropped because `kode_sumber` was missing or unrecognised. Counted,
   * never guessed at: see `klasifikasiKode`.
   */
  skippedNoKode: number;
}

/**
 * The IKU / Lainnya split is a property of the *indikator* cell, not of the
 * Rencana Hasil Kerja. One RHK can sit under either kind of indikator, so
 * `rencanaHasilKerja` alone cannot classify anything -- that is why this reads
 * `kode_sumber`, which e-TPP attaches to the indikator object.
 *
 * Only the two tokens the export actually emits are accepted: `iku` and
 * `other` (rendered as the `iku` / `lainnya` badges in the HTML). Anything
 * else -- including an empty cell -- returns `null` and the row is dropped.
 *
 * An earlier version defaulted an empty value to IKU, and the version before
 * that defaulted it to Lainnya. Both are worse than dropping it: with no way to
 * tell which bucket a user belongs in, a silent guess mislabels a whole
 * notification and nothing anywhere reports it.
 */
type KodeSumber = "iku" | "other" | null;

function klasifikasiKode(raw: string | null | undefined): KodeSumber {
  const kode = (raw || "").trim().toLowerCase();
  if (kode === "iku") return "iku";
  if (kode === "other") return "other";
  return null;
}

/**
 * e-TPP stores these cells as multi-line text, so the raw value carries
 * embedded newlines. Left alone they render as ragged gaps inside a numbered
 * list in WhatsApp, which reads as broken formatting.
 */
function normalize(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function pushUnique(target: string[], seen: Set<string>, value: string): void {
  if (seen.has(value)) return;
  seen.add(value);
  target.push(value);
}

/**
 * Flattens an e-TPP "Data Kinerja Saya" import into the metadata that the
 * notification templates render.
 *
 * Per call, per user: the caller passes the items of exactly one parsed file,
 * and every accumulator below is a local. There is no module-level state, so
 * two users parsed back to back cannot see each other's RHK.
 *
 * Only the target table and the profile header survive in that export. Dialog
 * Kinerja, Penilaian Perilaku, and e-Monev are separate pages in the e-TPP app
 * and are not present in the saved HTML, so nothing here can fill them.
 */
export function extractEtppMetadata(
  items: ImportItem[],
  importDate = new Date()
): EtppExtraction {
  const rhkIku: string[] = [];
  const rhkLainnya: string[] = [];
  const seenIku = new Set<string>();
  const seenLainnya = new Set<string>();

  // First-seen order for both the RHK groups and the actions inside them, so
  // the message reads top to bottom the way the export does.
  const grupRa: EtppRencanaAksi[] = [];
  const grupRaByRhk = new Map<string, EtppRencanaAksi>();
  const seenAksi = new Map<string, Set<string>>();

  let skippedNoKode = 0;

  for (const item of items) {
    const kode = klasifikasiKode(item.kodeSumber);
    if (kode === null) {
      // Drop the whole row. Its Rencana Aksi is dropped with it: without a
      // classifiable RHK the action has no parent, and the message nests
      // actions under their RHK.
      skippedNoKode += 1;
      continue;
    }

    const rhk = normalize(item.rencanaHasilKerja);

    if (rhk) {
      pushUnique(
        kode === "iku" ? rhkIku : rhkLainnya,
        kode === "iku" ? seenIku : seenLainnya,
        rhk
      );
    }

    const aksi = normalize(item.rencanaAksi);
    if (!rhk || !aksi) continue;

    let grup = grupRaByRhk.get(rhk);
    if (!grup) {
      grup = { rhk, aksi: [] };
      grupRaByRhk.set(rhk, grup);
      grupRa.push(grup);
      seenAksi.set(rhk, new Set<string>());
    }
    pushUnique(grup.aksi, seenAksi.get(rhk)!, aksi);
  }

  return {
    metadata: {
      etpp_imported: true,
      rhk_iku: rhkIku,
      rhk_lainnya: rhkLainnya,
      ra: grupRa.filter((g) => g.aksi.length > 0),
      last_import: importDate.toISOString(),
    },
    skippedNoKode,
  };
}
