import type { ImportItem } from "../imports/types";

export type KodeLabel = "IKU" | "Lainnya";

/**
 * One pivot cell's quarterly targets, from e-TPP `row-7`.
 */
export interface EtppTriwulan {
  tw: number;
  target: string;
  satuan: string;
  realisasi: string | null;
  validasi: string | null;
}

/**
 * A Rencana Aksi, from e-TPP `row-4`, paired with its Kriteria Keberhasilan
 * (`row-5`). `kode` is the e-TPP numbering prefix ("RA1." / "KK1.1."), null
 * when the source carries none.
 */
export interface EtppAksi {
  teks: string;
  kode: string | null;
  kriteria_keberhasilan: string;
}

/**
 * An Output, from e-TPP `row-6`, with its per-triwulan targets from `row-7`.
 */
export interface EtppOutput {
  nama: string;
  kode: string | null;
  triwulan: EtppTriwulan[];
}

/**
 * One Rencana Hasil Kerja, rebuilt from every pivot row that shares its
 * indicator context.
 *
 * The grouping key is `intervensi | rencanaHasilKerja | indikator |
 * kode_sumber` rather than e-TPP's own `id_indikator`, because `id_indikator`
 * only reaches us on imports made after the parser started keeping it. Old rows
 * in `data_imports.data` are still grouped correctly by the context key.
 */
export interface EtppRhk {
  id_indikator: string | null;
  intervensi: string;
  rhk: string;
  indikator: string;
  kode_sumber: KodeLabel;
  target: string;
  aksi: EtppAksi[];
  output: EtppOutput[];
}

/**
 * Flat per-Output-per-triwulan view, for templates that iterate Outputs instead
 * of RHKs. One row per (Output, triwulan) pair that the source actually filled
 * in, so there are no placeholder rows: an Output carrying only a TW2 target
 * appears in `ra_output` exactly once and never shows up in `ra_output_tw`
 * during TW3.
 *
 * `target` and `satuan` are kept apart so a template can render them in its own
 * format ("{{target}} {{satuan}}", "target TW{{tw}}: {{target}}", ...).
 */
export interface EtppFlatRa {
  rhk: string;
  kode_sumber: KodeLabel;
  output_ra: string;
  tw: number;
  target: string;
  satuan: string;
  realisasi: string | null;
  validasi: string | null;
}

export interface EtppVariables {
  rhk: EtppRhk[];
  rhk_iku: EtppRhk[];
  rhk_lainnya: EtppRhk[];
  ra: EtppRhk[];
  /** Every Output/triwulan pair, all quarters. */
  ra_output: EtppFlatRa[];
  /** Only the rows for the triwulan in progress. */
  ra_output_tw: EtppFlatRa[];
}

export interface EtppExtraction {
  variables: EtppVariables;
  skippedNoKode: number;
}

const KODE_RA = /^(RA\s*\d+\s*[.)]?)\s*/i;
const KODE_KK = /^(KK\s*\d+(?:\.\d+)*\s*[.)]?)\s*/i;
const KODE_OUTPUT = /^(T\/O\s*\d+(?:\.\d+)*\s*[.)]?)\s*/i;

function tidy(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function splitKode(
  raw: string | null | undefined,
  pattern: RegExp
): { kode: string | null; teks: string } {
  const s = tidy(raw);
  if (!s) return { kode: null, teks: "" };
  const match = s.match(pattern);
  if (!match) return { kode: null, teks: s };
  return { kode: match[1].trim(), teks: s.slice(match[0].length).trim() };
}

function getCurrentTw(now: Date): number {
  return Math.ceil((now.getMonth() + 1) / 3);
}

function toNullable(value: string | null | undefined): string | null {
  const s = tidy(value);
  return s && s !== "-" && s !== "--" ? s : null;
}

function groupKey(item: ImportItem): string {
  const id = (item as ImportItem & { idIndikator?: string | null }).idIndikator;
  const key = tidy(id);
  if (key) return `id:${key}`;
  return [
    "ctx",
    tidy(item.intervensi),
    tidy(item.rencanaHasilKerja),
    tidy(item.indikator),
    tidy(item.kodeSumber),
  ].join("|");
}

/**
 * Rebuilds the e-TPP notification variables from parsed import items.
 *
 * Runs at send time rather than being snapshotted onto `users.metadata`, so a
 * template written today renders correctly against files imported before the
 * change -- no re-import needed.
 */
export function extractEtppVariables(
  items: ImportItem[],
  now: Date = new Date()
): EtppExtraction {
  const currentTw = getCurrentTw(now);
  const groups = new Map<string, EtppRhk>();
  const aksiSeen = new Map<string, Set<string>>();
  const outputIndex = new Map<string, Map<string, EtppOutput>>();
  const outputTwSeen = new Map<EtppOutput, Set<number>>();
  let skippedNoKode = 0;

  for (const item of items) {
    const kodeSumber = item.kodeSumber;
    if (kodeSumber !== "iku" && kodeSumber !== "other") {
      skippedNoKode++;
      continue;
    }

    const kode_sumber: KodeLabel = kodeSumber === "iku" ? "IKU" : "Lainnya";
    const key = groupKey(item);
    let group = groups.get(key);

    if (!group) {
      group = {
        id_indikator: tidy(
          (item as ImportItem & { idIndikator?: string | null }).idIndikator
        ) || null,
        intervensi: tidy(item.intervensi),
        rhk: tidy(item.rencanaHasilKerja),
        indikator: tidy(item.indikator),
        kode_sumber,
        target: tidy(item.target) || "-",
        aksi: [],
        output: [],
      };
      groups.set(key, group);
      aksiSeen.set(key, new Set());
      outputIndex.set(key, new Map());
    }

    const aksiRaw = tidy(item.rencanaAksi);
    if (aksiRaw && !aksiSeen.get(key)!.has(aksiRaw)) {
      aksiSeen.get(key)!.add(aksiRaw);
      const { kode, teks } = splitKode(aksiRaw, KODE_RA);
      group.aksi.push({
        teks,
        kode,
        kriteria_keberhasilan: splitKode(item.kriteriaKeberhasilan, KODE_KK)
          .teks,
      });
    }

    const outputRaw = tidy(item.output);
    if (!outputRaw) continue;

    const outputs = outputIndex.get(key)!;
    let output = outputs.get(outputRaw);
    if (!output) {
      const { kode, teks } = splitKode(outputRaw, KODE_OUTPUT);
      output = { nama: teks, kode, triwulan: [] };
      outputs.set(outputRaw, output);
      outputTwSeen.set(output, new Set());
      group.output.push(output);
    }

    if (!outputTwSeen.get(output)!.has(item.triwulan)) {
      outputTwSeen.get(output)!.add(item.triwulan);
      output.triwulan.push({
        tw: item.triwulan,
        target: tidy(item.targetValue) || "-",
        satuan: tidy(item.satuan),
        realisasi: toNullable(item.realisasi),
        validasi: toNullable(item.validasi),
      });
    }
  }

  const rhk = [...groups.values()];
  const rhkIku = rhk.filter((g) => g.kode_sumber === "IKU");
  const rhkLainnya = rhk.filter((g) => g.kode_sumber === "Lainnya");

  // Flat view: one row per (Output, triwulan) the source filled in. Rows the
  // e-TPP export left blank are skipped instead of being emitted as "-", so a
  // template iterating `ra_output` never has to hide placeholders itself.
  const raOutput: EtppFlatRa[] = [];
  for (const group of rhk) {
    for (const output of group.output) {
      for (const t of output.triwulan) {
        if (t.target === "-" && !t.satuan && !t.realisasi && !t.validasi) {
          continue;
        }
        raOutput.push({
          rhk: group.rhk,
          kode_sumber: group.kode_sumber,
          output_ra: output.nama,
          tw: t.tw,
          target: t.target,
          satuan: t.satuan,
          realisasi: t.realisasi,
          validasi: t.validasi,
        });
      }
    }
  }

  const raOutputTw = raOutput.filter((r) => r.tw === currentTw);

  return {
    variables: {
      rhk,
      rhk_iku: rhkIku,
      rhk_lainnya: rhkLainnya,
      ra: rhk,
      ra_output: raOutput,
      ra_output_tw: raOutputTw,
    },
    skippedNoKode,
  };
}