/**
 * The e-TPP reminder message, shared by the template editor and any test that
 * needs to render the exact text users will receive.
 *
 * Four rules shape the block markup:
 *
 * 1. `{{#if ra.length}}` guards the list, and `.length` is not optional:
 *    `isTruthy` in `lib/template-engine.ts` returns true for an empty array, so
 *    a bare `{{#if ra}}` would render the section for a user with nothing in it.
 * 2. `{{#else}}` carries an instruction, not an apology. A user whose metadata
 *    predates the nested-`ra` shape has no `ra` key at all, so the loop would
 *    otherwise ship a section heading with nothing under it -- the exact failure
 *    that `ETPP_META_VERSION` exists to surface. Telling them to re-import
 *    turns an empty message into a recoverable one.
 * 3. The RA heading sits *outside* the guard. Both branches produce content, so
 *    nothing is left bare, and the section still names itself for a user who
 *    only sees the re-import notice.
 * 4. `ra` is nested -- each group carries its own `kode_sumber` and `rhk` with
 *    the `aksi` beneath it -- so the loops nest. `{{#each ra}}` yields the
 *    group, `{{#each aksi}}` yields its actions. A flat list would repeat the
 *    RHK once per action.
 *
 * Every `{{#if}}` / `{{#each}}` closes on the same line as its body: a closing
 * tag on its own line leaves a literal newline behind and WhatsApp renders it as
 * a blank line.
 *
 * `{{bulan_ini}}` is resolved at send time, not from the user's metadata; see
 * `formatBulanIni` in `lib/imports/variables.ts`.
 */
export const ETPP_PRESET = `Halo Bapak/Ibu:
{{name}}
{{jabatan}}
{{unitKerja}},

Ini adalah pesan otomatis dari SI-MPOK NORI Kecamatan Palmerah. Memasuki bulan {{bulan_ini}}, berikut adalah target kinerja yang perlu Anda laksanakan:

🎯 e-TPP (https://etpp.jakarta.go.id/):
{{#if rhk_lainnya.length}}1. Target Rencana Hasil Kerja (RHK) Lainnya:
{{#each rhk_lainnya}}{{@number}}. {{this}}
{{/each}}{{/if}}
2. Target Rencana Aksi (RA) dari RHK IKU dan RHK Lainnya:
{{#if ra.length}}{{#each ra}}• [{{kode_sumber}}] {{rhk}}
{{#each aksi}}   - {{this}}
{{/each}}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat Rencana Aksi.{{/if}}
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
    body: "2. Target Rencana Aksi (RA) dari RHK IKU dan RHK Lainnya:\n{{#if ra.length}}{{#each ra}}• [{{kode_sumber}}] {{rhk}}\n{{#each aksi}}   - {{this}}\n{{/each}}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat Rencana Aksi.{{/if}}",
  },
  {
    key: "periode",
    label: "periodeBlock",
    body: "{{bulan_ini}}",
  },
];
