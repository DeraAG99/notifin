/**
 * Proves the two things the e-TPP change hinges on, without a test runner:
 *
 *  1. A file imported BEFORE this change (no `idIndikator`, no `raw`) groups
 *     into exactly the same structure as a fresh one -- so nothing has to be
 *     re-imported.
 *  2. Rows already sitting in `data_imports.data` render through the shipped
 *     preset with no leftover tags.
 *
 * Run: bun scripts/verify-etpp.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { dataImports } from "../lib/db/schema";
import { ekinerjaHtmlParser } from "../lib/imports/parsers/ekinerja/html";
import { extractEtppVariables } from "../lib/users/etpp-extract";
import { templateEngine } from "../lib/template-engine";
import { ETPP_PRESET } from "../lib/templates/etpp-preset";
import type { ImportItem } from "../lib/imports/types";

const TW3 = new Date("2026-10-08T08:00:00+07:00");
const SCALARS = { name: "Preview", bulan_ini: "Oktober 2026", triwulan_ini: 3, dialog_periode: 2 };

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function structure(v: ReturnType<typeof extractEtppVariables>["variables"]) {
  return JSON.stringify({
    rhk: v.rhk.map((g) => [
      g.kode_sumber,
      g.rhk,
      g.indikator,
      g.target,
      g.aksi.map((a) => [a.kode, a.teks, a.kriteria_keberhasilan]),
      g.output.map((o) => [o.kode, o.nama, o.triwulan]),
    ]),
    flat: v.ra_output,
  });
}

// --- Fixture: parse the sample export -------------------------------------
// The export is gitignored (it is a real official's performance data), so this
// section is skipped when it is absent and the database checks below still run.
const fixture = Bun.file("docs/copy_table.html");
if (await fixture.exists()) {
  console.log("=== fixture: docs/copy_table.html ===");
  const { items, errors } = await ekinerjaHtmlParser.parse(await fixture.text());
  check("parses without errors", errors.length === 0, `${items.length} rows`);
  check(
    "produces 3 RHK groups",
    extractEtppVariables(items, TW3).variables.rhk.length === 3
  );

  // --- 1. Old imports need no re-import -----------------------------------
  console.log("\n=== backward compatibility ===");
  const legacy = items.map(({ idIndikator, raw, ...rest }) => {
    void idIndikator;
    void raw;
    return rest as ImportItem;
  });
  const fresh = extractEtppVariables(items, TW3);
  const old = extractEtppVariables(legacy, TW3);
  check(
    "rows without idIndikator group identically",
    structure(fresh.variables) === structure(old.variables),
    `${old.variables.rhk.length} groups either way`
  );

  const noKode = extractEtppVariables(items.map((i) => ({ ...i, kodeSumber: null })), TW3);
  check(
    "rows without kode_sumber are skipped, not mislabelled",
    noKode.skippedNoKode === items.length && noKode.variables.rhk.length === 0
  );
} else {
  console.log("=== fixture absent (gitignored) — skipping parse checks ===");
}

// --- 2. Edge cases -------------------------------------------------------
console.log("\n=== edge cases ===");
const empty = templateEngine.render(ETPP_PRESET, {
  ...SCALARS,
  ...extractEtppVariables([], TW3).variables,
});
check(
  "empty import shows the re-import notice",
  (empty.match(/⚠️/g) || []).length === 3
);

check(
  "bare {{else}} resolves (the form the old preset shipped)",
  templateEngine.render("{{#if x.length}}ADA{{else}}TIDAK ADA{{/if}}", { x: [1] }) === "ADA" &&
    templateEngine.render("{{#if x.length}}ADA{{else}}TIDAK ADA{{/if}}", { x: [] }) === "TIDAK ADA"
);

// --- 3. Rows already in the database -------------------------------------
console.log("\n=== stored data_imports.data ===");
const stored = await db
  .select({
    fileName: dataImports.fileName,
    createdAt: dataImports.createdAt,
    data: dataImports.data,
  })
  .from(dataImports)
  .where(eq(dataImports.engine, "ekinerja-json"));

check("found at least one stored import", stored.length > 0, `${stored.length} found`);

for (const row of stored) {
  const rows = (row.data ?? []) as ImportItem[];
  const { variables } = extractEtppVariables(rows, TW3);
  const rendered = templateEngine.render(ETPP_PRESET, { ...SCALARS, ...variables });
  const preChange = !rows.some((i) => (i as ImportItem).idIndikator);

  console.log(`\n  ${row.fileName} (${row.createdAt?.toISOString().slice(0, 10) ?? "unknown date"})${preChange ? " [pre-change]" : ""}`);
  console.log(`    ${rows.length} stored rows -> ${variables.rhk.length} RHK, ${variables.ra_output.length} outputs`);
  check(`    renders clean (${rendered.length} chars)`, !/\{\{[^}]+\}\}/.test(rendered));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
