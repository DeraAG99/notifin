import type { ImportItem } from "../imports/types";

export interface EtppMetadata {
  etpp_imported: true;
  bulan_ini: string;
  triwulan_ini: number;
  rhk_iku: string[];
  rhk_lainnya: string[];
  last_import: string;
}

export function extractEtppMetadata(items: ImportItem[], importDate = new Date()): EtppMetadata {
  const bulanIni = importDate.toLocaleString("id-ID", { month: "long", year: "numeric" });
  const triwulanIni = Math.ceil((importDate.getMonth() + 1) / 3) as 1 | 2 | 3 | 4;

  const rhkIku: string[] = [];
  const rhkLainnya: string[] = [];

  const seenIku = new Set<string>();
  const seenLainnya = new Set<string>();

  for (const item of items) {
    const nama = item.intervensi?.trim();
    if (!nama) continue;

    const kode = (item.kodeSumber || "").trim().toUpperCase();

    if (kode.includes("IKU") || kode === "RHK" || kode === "") {
      if (!seenIku.has(nama)) {
        seenIku.add(nama);
        rhkIku.push(nama);
      }
    } else {
      if (!seenLainnya.has(nama)) {
        seenLainnya.add(nama);
        rhkLainnya.push(nama);
      }
    }
  }

  return {
    etpp_imported: true,
    bulan_ini: bulanIni,
    triwulan_ini: triwulanIni,
    rhk_iku: rhkIku,
    rhk_lainnya: rhkLainnya,
    last_import: importDate.toISOString(),
  };
}