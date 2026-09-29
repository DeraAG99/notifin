import type { ImportItem } from "../imports/types";

/**
 * Bumped whenever the shape written into `users.metadata` changes.
 *
 * 1: flat `ra` (list of strings).
 * 2: nested `ra` with `kode_sumber` and stripped `RA<n>.` prefixes.
 * 3: nested `ra` with `kode_sumber`, stripped `RA<n>.` prefixes, and per-group
 *    `output` array capturing the Target/Output pair per triwulan.
 *
 * Metadata written before a bump is still readable -- every field it carries
 * simply goes through `isEtppMetadataStale`, which is what turns a silent
 * blank section in a sent message into a warning the admin can act on.
 */
export const ETPP_META_VERSION = 3;

/**
 * How the `kode_sumber` token is spelled in the message.
 *
 * Mapped here rather than in the template: the two tokens e-TPP emits read as
 * codes, not words ("other" in particular is meaningless to a user), and
 * translating inside `{{#each}}` would mean a conditional in the template body
 * -- something an admin editing the message can easily break. One place, no
 * template logic.
 */
export type KodeLabel = "IKU" | "Lainnya";

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
  /** Which kind of indikator this group came from, as the user sees it. */
  kode_sumber: KodeLabel;
  aksi: string[];
  /** Output/Target per triwulan, from row-6 (output) and row-7 (target). */
  output: EtppOutput[];
}

/**
 * Output item per triwulan, parsed from row-6 (output name) and row-7
 * (target, satuan, tw).
 */
export interface EtppOutput {
  /** Output name with T/O code stripped.**/
  nama: string;
  /** Triwulan number as string: "1" | "2" | "3" | "4". */
  tw: string;
  satuan: string;
  target: string;
}

export interface EtppMetadata {
  etpp_imported: true;
  /** `rencanaHasilKerja` for rows whose `indikator.kode_sumber` is `iku`. */
  rhk_iku: string[];
  /** `rencanaHasilKerja` for rows whose `indikator.kode_sumber` is `other`. */
  rhk_lainnya: string[];
  /** `rencanaAksi` nested under their parent RHK, IKU and Lainnya combined. */
  ra: EtppRencanaAksi[];
  etpp_meta_version: number;
  last_import: string;
  // Spreads into `users.metadata` (jsonb) and merges with unrelated keys.
  [key: string]: unknown;
}

/**
 * True when a user has e-TPP metadata that predates the current shape.
 *
 * Both symptoms of a stale write are silent, which is what makes this worth
 * checking rather than assuming: `ra` is absent, so `{{#each ra}}` renders
 * nothing and the message ships with a section heading and no content under it.
 * The import page surfaces it as a warning so the admin can ask for a
 * re-import instead of the user reporting an empty message.
 */
export function isEtppMetadataStale(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const meta = metadata as Record<string, unknown>;
  if (meta.etpp_imported !== true) return false;
  const version = typeof meta.etpp_meta_version === "number" ? meta.etpp_meta_version : 0;
  return version < ETPP_META_VERSION;
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

/** The two tokens above, spelled for the message. */
const LABEL_KODE: Record<Exclude<KodeSumber, null>, KodeLabel> = {
  iku: "IKU",
  other: "Lainnya",
};

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

/**
 * Drops the `RA1.` / `RA2.` numbering e-TPP stores in the Rencana Aksi cell.
 *
 * It is a table index, not part of the action, and it repeats under every RHK
 * in the export -- keeping it produces a message that reads "RA1. ..." once
 * per Rencana Hasil Kerja. The template already numbers the bullets, so the
 * number would also be a second, contradictory one.
 */
function stripRaPrefix(value: string): string {
  return value.replace(/^RA\d+\.\s*/i, "");
}

/**
 * Drops the `T/O\d+...` prefix from the output name.
 *
 * Handles T/O1., T/O1.1., T/O1.1.1., with trailing dot optional.
 * Case-insensitive because exports may vary.
 */
function stripToCode(value: string): string {
  return value.replace(/^T\/O\d+(\.\d+)*\.?\s*/i, "").trim();
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
  //
  // The group is keyed by RHK alone, so a RHK that appears under more than one
  // kind of indikator keeps the label of its first row rather than appearing
  // twice. In practice one RHK sits under a single indikator; the split belongs
  // to the indikator, which is why `kode_sumber` cannot be derived from the RHK.
  const grupRa: EtppRencanaAksi[] = [];
  const grupRaByRhk = new Map<string, EtppRencanaAksi>();
  const seenAksi = new Map<string, Set<string>>();
  const seenOutput = new Map<string, Set<string>>();

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

    const aksi = stripRaPrefix(normalize(item.rencanaAksi));
    if (!rhk || !aksi) continue;

    let grup = grupRaByRhk.get(rhk);
    if (!grup) {
      grup = { rhk, kode_sumber: LABEL_KODE[kode], aksi: [], output: [] };
      grupRaByRhk.set(rhk, grup);
      grupRa.push(grup);
      seenAksi.set(rhk, new Set<string>());
      seenOutput.set(rhk, new Set<string>());
    }
    pushUnique(grup.aksi, seenAksi.get(rhk)!, aksi);

    // Collect output + target per triwulan.
    // item.output contains the T/O phrase, item.targetValue is the target,
    // item.satuan is the unit, item.triwulan is the TW.
    if (item.output) {
      const nama = stripToCode(item.output);
      if (nama) {
        const outputKey = `${item.triwulan}|${nama}|${item.satuan}|${item.targetValue}`;
        const outSet = seenOutput.get(rhk)!;
        if (!outSet.has(outputKey)) {
          outSet.add(outputKey);
          grup.output.push({
            nama,
            tw: String(item.triwulan),
            satuan: item.satuan || "",
            target: item.targetValue || "",
          });
        }
      }
    }
  }

  return {
    metadata: {
      etpp_imported: true,
      rhk_iku: rhkIku,
      rhk_lainnya: rhkLainnya,
      ra: grupRa.filter((g) => g.aksi.length > 0),
      etpp_meta_version: ETPP_META_VERSION,
      last_import: importDate.toISOString(),
    },
    skippedNoKode,
  };
}

/**
 * Helper: returns a shallow copy of the ra array with output items filtered
 * to keep only those for the given triwulan.
 *
 * Used by the notification worker to show only current-TW targets.
 */
export function filterRaForCurrentTw(
  ra: EtppRencanaAksi[],
  currentTw: number
): EtppRencanaAksi[] {
  return ra.map((g) => ({
    ...g,
    output: g.output.filter((o) => Number(o.tw) === currentTw),
  }));
}
