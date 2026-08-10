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
};

export type ImportSource = "ekinerja" | "monev";
export type ImportFormat = "html" | "xlsx";

export interface ParseResult {
  items: ImportItem[];
  errors: string[];
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
