/**
 * The e-TPP reminder message, shared by the template editor and any test that
 * needs to render the exact text users will receive.
 *
 * Two rules shape the block markup:
 *
 * 1. The heading lives *inside* the `{{#if}}`. With it outside, a user whose
 *    list is empty still receives a bare "1. Target Rencana Hasil Kerja (RHK)
 *    Lainnya:" with nothing under it.
 * 2. The guard tests `.length`, never the variable itself. `isTruthy` in
 *    `lib/template-engine.ts` returns true for an empty array, so `{{#if ra}}`
 *    would always render the section.
 */
export const ETPP_PRESET = `Halo Bapak/Ibu:
{{name}}
{{jabatan}}
{{unitKerja}},

Ini adalah pesan otomatis dari SI-MPOK NORI Kecamatan Palmerah. Memasuki bulan {{bulan_ini}} di Triwulan {{triwulan_ini}}, berikut adalah target kinerja yang perlu Anda laksanakan:

🎯 e-TPP (https://etpp.jakarta.go.id/):
{{#if rhk_lainnya.length}}1. Target Rencana Hasil Kerja (RHK) Lainnya:
{{#each rhk_lainnya}}{{@number}}. {{this}}
{{/each}}{{/if}}
{{#if ra.length}}2. Target Rencana Aksi (RA) dari RHK IKU dan RHK Lainnya:
{{#each ra}}{{@number}}. {{this}}
{{/each}}{{/if}}
⚠️ PERINGATAN PENTING:
Mohon untuk mulai mempersiapkan pelaksanaan tugas dan dokumen pendukungnya sejak awal periode agar tidak menumpuk di akhir bulan.

Semangat berkinerja dan wujudkan tata kelola yang profesional!
Salam,
Subbagian Keuangan Kecamatan Palmerah

Abaikan pesan ini jika Anda sudah menginput realisasi target tersebut ke E-TPP.`;

export interface EtppBlock {
  key: string;
  label: "rhkLainnyaBlock" | "rhkIkuBlock" | "raBlock" | "periodeBlock";
  body: string;
}

/** Insertable fragments, one per message section. */
export const ETPP_BLOCKS: EtppBlock[] = [
  {
    key: "rhkLainnya",
    label: "rhkLainnyaBlock",
    body: "{{#if rhk_lainnya.length}}1. Target Rencana Hasil Kerja (RHK) Lainnya:\n{{#each rhk_lainnya}}{{@number}}. {{this}}\n{{/each}}{{/if}}",
  },
  {
    key: "rhkIku",
    label: "rhkIkuBlock",
    body: "{{#if rhk_iku.length}}1. Target Rencana Hasil Kerja (RHK) IKU:\n{{#each rhk_iku}}{{@number}}. {{this}}\n{{/each}}{{/if}}",
  },
  {
    key: "ra",
    label: "raBlock",
    body: "{{#if ra.length}}2. Target Rencana Aksi (RA) dari RHK IKU dan RHK Lainnya:\n{{#each ra}}{{@number}}. {{this}}\n{{/each}}{{/if}}",
  },
  {
    key: "periode",
    label: "periodeBlock",
    body: "{{bulan_ini}} (Triwulan {{triwulan_ini}})",
  },
];
