import type {
  ImportParser,
  ParseResult,
  ImportItem,
  SourceProfile,
} from "../../types";

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

/** Shape of the `user` object embedded in the e-TPP page payload. */
interface EtppUserPayload {
  v_userid?: string;
  v_username?: string;
  email?: string;
  current_eselon?: string | number;
  /**
   * NOTE the naming trap: e-TPP calls the *unit kerja* (e.g. a kecamatan)
   * `perangkat_daerah`, and its parent (e.g. the kota) `perangkat_daerah_induk`.
   * So `perangkat_daerah.nalok` is the unit kerja, NOT the perangkat daerah.
   */
  perangkat_daerah?: { nalok?: string };
  perangkat_daerah_induk?: { nalok?: string };
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

/**
 * Matches the header's uppercase micro-label followed by its value, e.g.
 *   <div class="fs-nano ..."> Jabatan </div>
 *   <div class="text-xs ..."> KEPALA SUB BAGIAN KEUANGAN </div>
 */
const PROFILE_LABEL_REGEX =
  /<div class="fs-nano[^"]*">\s*([^<]{2,40}?)\s*<\/div>\s*<div class="text-xs[^"]*">\s*([^<]{2,120}?)\s*<\/div>/g;

const LABEL_MAP: Record<string, keyof SourceProfile> = {
  jabatan: "jabatan",
  "unit kerja": "unitKerja",
  unitkerja: "unitKerja",
  "perangkat daerah": "perangkatDaerah",
  perangkatdaerah: "perangkatDaerah",
};

function cleanProfileValue(value: string | null | undefined): string | null {
  if (!value) return null;
  // The rendered values are uppercased and contain a leading space from the
  // template; collapse runs of whitespace and drop any HTML entity leftovers.
  const s = value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return s && s !== "-" && s !== "--" ? s : null;
}

/**
 * Find `"key" : { ... }` in a blob and return the balanced object substring.
 *
 * A regex cannot do this reliably: the e-TPP payload nests objects and contains
 * braces inside strings, so we scan for the opening brace and then count depth,
 * skipping string literals and their escapes. Returns null when the key is
 * absent or the object never closes.
 */
function sliceJsonObject(source: string, key: string): string | null {
  const keyRe = new RegExp(`"${key}"\\s*:\\s*\\{`, "g");
  const match = keyRe.exec(source);
  if (!match) return null;

  // Start at the opening brace, not at the key -- the slice has to be a
  // standalone JSON object, and `"key":{...}` alone is not parseable.
  const start = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Extract Jabatan / Unit Kerja / Perangkat Daerah from an e-TPP
 * "Data Kinerja Saya" export.
 *
 * Two sources, in priority order:
 *
 * 1. The visible header label-value blocks. This is the authoritative one --
 *    it is what the user actually sees on screen, and its labels are unambiguous.
 * 2. The embedded `"user":{...}` payload. Used only to fill gaps (name, email,
 *    user id, eselon) and as a fallback if the markup around the header changes.
 *
 * Returns an empty object when neither source yields anything, so callers can
 * distinguish "file has no profile" from "file has a blank profile".
 */
export function extractProfile(html: string): SourceProfile {
  const profile: SourceProfile = {};

  // 1. Visible label/value blocks.
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = PROFILE_LABEL_REGEX.exec(html)) !== null) {
    const key = LABEL_MAP[labelMatch[1].trim().toLowerCase()];
    if (!key) continue;
    const value = cleanProfileValue(labelMatch[2]);
    if (value && !profile[key]) {
      profile[key] = value;
    }
  }

  // 2. Embedded payload. Only fills what the header did not provide.
  const raw = sliceJsonObject(html, "user");
  const payload = raw ? safeJson<EtppUserPayload>(raw) : null;

  if (payload) {
    const name = cleanProfileValue(payload.v_username);
    if (name) profile.name = name;

    const email = cleanProfileValue(payload.email);
    if (email) profile.email = email;

    const userId = cleanProfileValue(payload.v_userid);
    if (userId) profile.userId = userId;

    const eselon = cleanProfileValue(
      payload.current_eselon === undefined ? null : String(payload.current_eselon)
    );
    if (eselon) profile.eselon = eselon;

    // Remember the trap documented on EtppUserPayload: for a kecamatan staff,
    // perangkat_daerah.nalok is the UNIT KERJA and perangkat_daerah_induk.nalok
    // is the PERANGKAT DAERAH.
    if (!profile.unitKerja) {
      const unitKerja = cleanProfileValue(payload.perangkat_daerah?.nalok);
      if (unitKerja) profile.unitKerja = unitKerja;
    }
    if (!profile.perangkatDaerah) {
      const perangkatDaerah = cleanProfileValue(payload.perangkat_daerah_induk?.nalok);
      if (perangkatDaerah) profile.perangkatDaerah = perangkatDaerah;
    }
  }

  return profile;
}

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

    return Promise.resolve({ items, errors, profile: extractProfile(html) });
  },
};
