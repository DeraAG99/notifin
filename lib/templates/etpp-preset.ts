export const ETPP_PRESET = `🎯 e-TPP (https://etpp.jakarta.go.id/)

Periode: {{bulan_ini}} — Triwulan {{triwulan_ini}} (dialog {{dialog_periode}})

1. Target Rencana Hasil Kerja (RHK) IKU:
{{#if rhk_iku.length}}{{#each rhk_iku}}• {{kode_sumber}}: {{rhk}}
   Indikator: {{indikator}}
   Target: {{target}}
{{#if aksi.length}}{{#each aksi}}   - {{#if kode}}[{{kode}}] {{/if}}{{teks}} (KK: {{kriteria_keberhasilan}})
{{/each}}{{/if}}{{#each output}}   Output: {{nama}} —{{#each triwulan}} TW{{tw}}: {{target}} {{satuan}}{{/each}}
{{/each}}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat RHK IKU.{{/if}}

2. Target Rencana Hasil Kerja (RHK) Lainnya:
{{#if rhk_lainnya.length}}{{#each rhk_lainnya}}• {{kode_sumber}}: {{rhk}}
   Indikator: {{indikator}}
   Target: {{target}}
{{#if aksi.length}}{{#each aksi}}   - {{#if kode}}[{{kode}}] {{/if}}{{teks}} (KK: {{kriteria_keberhasilan}})
{{/each}}{{/if}}{{#each output}}   Output: {{nama}} —{{#each triwulan}} TW{{tw}}: {{target}} {{satuan}}{{/each}}
{{/each}}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat RHK Lainnya.{{/if}}

3. Rekapitulasi Target Output — Triwulan {{triwulan_ini}}:
{{#if ra_output_tw.length}}{{#each ra_output_tw}}• [{{kode_sumber}}] {{rhk}}
   → {{output_ra}}: {{target}} {{satuan}}
{{/each}}{{#else}}⚠️ Belum ada output dengan target di triwulan ini.{{/if}}
`;

export interface EtppBlock {
  key: string;
  label:
    | "rhkLainnyaBlock"
    | "rhkIkuBlock"
    | "raBlock"
    | "periodeBlock"
    | "rekapBlock";
  body: string;
}

/** Nested RHK block: aksi and output stay under their Rencana Hasil Kerja. */
const RHK_GROUP = `• {{kode_sumber}}: {{rhk}}
   Indikator: {{indikator}}
   Target: {{target}}
{{#if aksi.length}}{{#each aksi}}   - {{#if kode}}[{{kode}}] {{/if}}{{teks}} (KK: {{kriteria_keberhasilan}})
{{/each}}{{/if}}{{#each output}}   Output: {{nama}} —{{#each triwulan}} TW{{tw}}: {{target}} {{satuan}}{{/each}}
{{/each}}`;

export const ETPP_BLOCKS: EtppBlock[] = [
  {
    key: "rhkLainnya",
    label: "rhkLainnyaBlock",
    body: `{{#if rhk_lainnya.length}}{{#each rhk_lainnya}}${RHK_GROUP}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat RHK Lainnya.{{/if}}`,
  },
  {
    key: "rhkIku",
    label: "rhkIkuBlock",
    body: `{{#if rhk_iku.length}}{{#each rhk_iku}}${RHK_GROUP}{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat RHK IKU.{{/if}}`,
  },
  {
    key: "ra",
    label: "raBlock",
    body: "{{#if ra.length}}{{#each ra}}" + RHK_GROUP + "{{/each}}{{#else}}⚠️ Silakan import ulang data kinerja Anda untuk melihat Rencana Hasil Kerja.{{/if}}",
  },
  {
    key: "rekap",
    label: "rekapBlock",
    body: "{{#if ra_output_tw.length}}{{#each ra_output_tw}}• [{{kode_sumber}}] {{rhk}}\n   → {{output_ra}}: {{target}} {{satuan}}\n{{/each}}{{#else}}⚠️ Belum ada output dengan target di triwulan ini.{{/if}}",
  },
  {
    key: "periode",
    label: "periodeBlock",
    body: "{{bulan_ini}} — Triwulan {{triwulan_ini}} (dialog {{dialog_periode}})",
  },
];
