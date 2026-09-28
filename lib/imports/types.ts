export type ImportItem = {
  intervensi: string;
  rencanaHasilKerja: string;
  indikator: string;
  kodeSumber: string | null;
  target: string | null;
  rencanaAksi: string;
  kriteriaKeberhasilan: string;
  output: string;
  triwulan: number;
  satuan: string;
  targetValue: string;
  realisasi: string | null;
  validasi: string | null;
  konsolidasi: string | null;
  polarisasi: string | null;
  capaian: string | null;
  keterangan: string | null;
  keteranganValidasi: string | null;
  raw?: Record<string, string | null>;
};

export type ImportSource = "ekinerja" | "monev";
export type ImportFormat = "html" | "xlsx";

/**
 * Identity information scraped from the header/profile block of a source file,
 * as opposed to the performance table.
 *
 * Only the e-TPP "Data Kinerja Saya" export carries this today. The parser
 * scrapes the visible `Jabatan` / `Perangkat Daerah` / `Unit Kerja` label-value
 * pairs and falls back to the page's embedded `user` JSON payload.
 */
export interface SourceProfile {
  name?: string | null;
  jabatan?: string | null;
  unitKerja?: string | null;
  perangkatDaerah?: string | null;
  email?: string | null;
  /** e-TPP internal user id (`v_userid`). Not a NIP -- kept for traceability. */
  userId?: string | null;
  eselon?: string | null;
}

export interface ParseResult {
  items: ImportItem[];
  errors: string[];
  /** Absent for sources that carry no profile block (Monev, PDUKPD, generic tables). */
  profile?: SourceProfile;
}

export interface ImportParser {
  format: ImportFormat;
  parse(content: string | ArrayBuffer): Promise<ParseResult>;
}

export interface SourceDefinition {
  source: ImportSource;
  label: string;
  formats: Partial<Record<ImportFormat, ImportParser>>;
}
