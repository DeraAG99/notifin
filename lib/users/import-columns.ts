import Papa from "papaparse";

/**
 * Column contract for bulk user import, shared by the CSV and the Excel path so
 * the two never drift apart.
 *
 * Everything in this module is client-safe: no server imports, no DB. `xlsx` is
 * pulled in via dynamic `import()` inside the functions that need it, matching
 * the convention already used by the e-TPP and PDUKPD parsers, so the ~1MB
 * library is not pulled into the initial bundle.
 */

export interface CsvRow {
  name?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  jabatan?: string;
  unitKerja?: string;
}

export const USER_IMPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "timezone",
  "jabatan",
  "unit_kerja",
] as const;

export const TEMPLATE_SAMPLE_ROW: Record<string, string> = {
  name: "Ahmad Rizki",
  phone: "6281234567890",
  email: "ahmad@contoh.com",
  timezone: "Asia/Jakarta",
  jabatan: "KEPALA SUB BAGIAN KEUANGAN",
  unit_kerja: "KECAMATAN PALMERAH KOTA ADM. JAKARTA BARAT",
};

/**
 * Header aliases, keyed by their *normalised* form so they are actually
 * reachable. `normalizeHeader` lowercases and strips non-alphanumerics, so
 * `Unit Kerja`, `unit_kerja` and `unitKerja` all collapse to `unitkerja` -- a
 * key spelled `unitKerja` here would never be hit and the column would silently
 * import as empty.
 */
const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  name: "name",
  nama: "name",
  namapegawai: "name",
  namakaryawan: "name",
  pegawai: "name",
  jabatan: "jabatan",
  namajabatan: "jabatan",
  jabatannama: "jabatan",
  position: "jabatan",
  jab: "jabatan",
  unitkerja: "unitKerja",
  namaunitkerja: "unitKerja",
  unit: "unitKerja",
  satuankerja: "unitKerja",
  phone: "phone",
  nohp: "phone",
  notelp: "phone",
  nomortelepon: "phone",
  telepon: "phone",
  hp: "phone",
  wa: "phone",
  whatsapp: "phone",
  email: "email",
  surel: "email",
  emailaddress: "email",
  timezone: "timezone",
  zonawaktu: "timezone",
};

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function fieldForHeader(header: string): keyof CsvRow | null {
  return HEADER_ALIASES[normalizeHeader(header)] ?? null;
}

const SCIENTIFIC_NOTATION = /^[+-]?\d+(\.\d+)?e[+-]?\d+$/i;

/**
 * Repair the damage Excel does to phone numbers.
 *
 * The order matters. A cell stored as a number arrives here as a real JS number
 * and `String()` already gives the exact digits, because every phone number fits
 * comfortably inside `Number.MAX_SAFE_INTEGER`. Scientific notation only shows up
 * when the *display* text leaked through (a text cell that Excel decided to
 * render that way, or a CSV export of one).
 */
export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }

  let s = String(value).trim();
  if (!s) return null;

  // A numeric string that survived as text, e.g. "6281234567890.0".
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");

  // Scientific notation, e.g. 6.28123E+12 -> 6281230000000. Note this is lossy
  // for the original value; `analyzePhone` is what surfaces that to the user.
  if (SCIENTIFIC_NOTATION.test(s)) s = String(Number(s));

  // Excel's display formatting can insert thousands separators.
  s = s.replace(/[.\s,]/g, "");

  return s.length > 0 ? s : null;
}

/** True when a phone value is structurally wrong (non-digits, or too short). */
export function looksLikeMangledPhone(phone: string | null): boolean {
  if (!phone) return false;
  if (!/^\d+$/.test(phone)) return true;
  return phone.length < 10;
}

/**
 * Explain why a phone value is suspect, given the value as it appeared in the
 * file and the normalised form we ended up with.
 *
 * This needs the *original* value, which is why it runs client-side where the
 * uploaded file is still in hand -- by the time a row reaches the server the
 * evidence of what Excel did is gone.
 */
export function analyzePhone(original: unknown, phone: string | null): string | null {
  if (phone === null) return null;

  if (typeof original === "number") {
    return `Nomor telepon tersimpan sebagai angka (${phone}). Format kolom phone sebagai Teks agar angka tidak diubah Excel.`;
  }

  const text = String(original ?? "").trim();
  if (SCIENTIFIC_NOTATION.test(text)) {
    return `Nomor telepon "${text}" sudah jadi notasi ilmiah dan sebagian digit hilang, mungkin "${phone}". Format kolom phone sebagai Teks lalu isi ulang.`;
  }

  if (looksLikeMangledPhone(phone)) {
    return `Nomor telepon "${phone}" hanya ${phone.length} digit atau mengandung karakter non-angka, periksa kembali.`;
  }

  return null;
}

/** Map one raw record (from PapaParse or SheetJS) onto a user row. */
export function mapRawRow(raw: Record<string, unknown>): CsvRow {
  const row: CsvRow = {};
  for (const [header, value] of Object.entries(raw)) {
    const field = fieldForHeader(header);
    if (!field || value === null || value === undefined) continue;
    const asString = String(value).trim();
    if (asString) row[field] = asString;
  }
  row.phone = normalizePhone(row.phone) ?? undefined;
  return row;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadUserTemplateCsv() {
  const csv = [
    USER_IMPORT_COLUMNS.join(","),
    USER_IMPORT_COLUMNS.map((c) => TEMPLATE_SAMPLE_ROW[c]).join(","),
  ].join("\n");

  // The BOM keeps Excel from opening the file as legacy ANSI, which would mangle
  // the sample values on a non-UTF-8 locale.
  triggerDownload(
    new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    "template-pengguna-si-mpok-nori.csv"
  );
}

const INSTRUCTION_ROWS: Array<[string, string, string, string]> = [
  ["Kolom", "Wajib?", "Keterangan", "Contoh"],
  ["name", "Wajib", "Nama lengkap pengguna", "Ahmad Rizki"],
  ["phone", "Sangat disarankan", "Nomor WhatsApp, hanya angka. Isi minimal salah satu: phone atau email.", "6281234567890"],
  ["email", "Sangat disarankan", "Alamat email, harus valid", "ahmad@contoh.com"],
  ["timezone", "Opsional", "Kosongkan untuk memakai Asia/Jakarta", "Asia/Jakarta"],
  ["jabatan", "Opsional", "Jabatan / posisi pegawai. Bisa juga terisi otomatis dari import data e-TPP.", "KEPALA SUB BAGIAN KEUANGAN"],
  ["unit_kerja", "Opsional", "Unit kerja asal pegawai", "KECAMATAN PALMERAH KOTA ADM. JAKARTA BARAT"],
  ["", "", "", ""],
  ["PENTING", "", "", ""],
  [
    "Nomor telepon",
    "",
    "Format kolom 'phone' sebagai TEKS sebelum mengisi (Home > Format > Cells > Text). Kalau dibiarkan sebagai angka, Excel menghapus nol di depan dan nomor panjang bisa jadi notasi ilmiah, sehingga data yang terimport jadi salah.",
    "",
  ],
  [
    "Import ulang",
    "",
    " Aman. Menjalankan file yang sama dua kali tidak akan menggandakan pengguna: yang sudah ada akan diperbarui, bukan diduplikasi.",
    "",
  ],
  [
    "Pencocokan",
    "",
    "Pengguna dicocokkan lewat email dulu, lalu nomor telepon. Hanya baris yang punya email ATAU nomor telepon yang bisa dicocokkan.",
    "",
  ],
  [
    "Kolom kosong",
    "",
    "Kolom yang dikosongkan pada baris pembaruan TIDAK akan menimpa nilai lama, sehingga jabatan/unit kerja yang diisi manual tetap aman.",
    "",
  ],
];

/** Number of blank-but-text-formatted rows written under the phone header. */
const PHONE_PREFILL_ROWS = 200;

/**
 * Build the "Pengguna" + "Petunjuk" template workbook.
 *
 * Returns the workbook rather than saving it so the download path stays a thin
 * browser wrapper and the workbook can be round-tripped in tests.
 */
export async function buildUserTemplateWorkbook() {
  const XLSX = await import("xlsx");

  const headerRow = [...USER_IMPORT_COLUMNS];
  const sampleRow = USER_IMPORT_COLUMNS.map((c) => TEMPLATE_SAMPLE_ROW[c]);

  const sheet = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
  const phoneCol = USER_IMPORT_COLUMNS.indexOf("phone");

  const setText = (row: number, value: string) => {
    const ref = XLSX.utils.encode_cell({ r: row, c: phoneCol });
    sheet[ref] = { t: "s", v: value, z: "@" };
  };

  setText(0, headerRow[phoneCol]);
  setText(1, sampleRow[phoneCol]);

  // Pre-write blank, text-formatted cells down the phone column. Excel applies a
  // cell's number format to whatever the user types into it, so pre-formatting
  // empty cells is what actually protects leading zeros -- formatting the sample
  // row alone would not.
  for (let r = 2; r < PHONE_PREFILL_ROWS; r++) {
    setText(r, "");
  }

  sheet["!cols"] = [
    { wch: 28 },
    { wch: 20 },
    { wch: 26 },
    { wch: 16 },
    { wch: 38 },
    { wch: 42 },
  ];

  const guide = XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS);
  guide["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 96 }, { wch: 44 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pengguna");
  XLSX.utils.book_append_sheet(workbook, guide, "Petunjuk");

  return workbook;
}

export async function downloadUserTemplateXlsx() {
  const XLSX = await import("xlsx");

  const workbook = await buildUserTemplateWorkbook();
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "template-pengguna-si-mpok-nori.xlsx"
  );
}

export interface ExportUserRow {
  name: string;
  jabatan: string;
  unitKerja: string;
  phone: string;
  email: string;
  timezone: string;
  status: string;
}

export async function downloadUsersExcel(users: ExportUserRow[]) {
  const XLSX = await import("xlsx");

  const headers = ["Nama", "Jabatan", "Unit Kerja", "Telepon", "Email", "Timezone", "Status"];
  const data = users.map((u) => [
    u.name,
    u.jabatan || "",
    u.unitKerja || "",
    u.phone || "",
    u.email || "",
    u.timezone || "",
    u.status,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 30 },
    { wch: 35 },
    { wch: 16 },
    { wch: 25 },
    { wch: 18 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pengguna");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `data-pengguna-${new Date().toISOString().split("T")[0]}.xlsx`
  );
}
/**
 * Read an uploaded `.csv` / `.xlsx` / `.xls` file into raw records keyed by
 * header, without interpreting the values yet.
 *
 * `raw: true` for the Excel path is deliberate and load-bearing. With
 * `raw: false` SheetJS returns the cell's *display* text, and Excel renders a
 * 13-digit phone in General format as `6.28123E+12` -- six significant digits,
 * already destroyed before we ever see it. Reading the stored value instead
 * gives the exact digits, and leaves the original cell value available for
 * `analyzePhone` to inspect.
 */
export async function readUserRecords(file: File): Promise<Record<string, unknown>[]> {
  const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();

  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    return XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sheetName],
      { defval: "", raw: true }
    );
  }

  // Read the CSV through text() rather than handing PapaParse the File directly.
  // PapaParse routes a File through FileReader, which is unavailable outside the
  // browser and buffers the whole file anyway -- text() works everywhere and is
  // the natural API for a text format.
  const text = await file.text();

  return new Promise((resolve) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, unknown>[]),
      error: () => resolve([]),
    });
  });
}
