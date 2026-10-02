/**
 * Proves the things the e-TPP change hinges on, without a test runner:
 *
 *  1. A file imported BEFORE this change (no `idIndikator`, no `raw`) groups
 *     into exactly the same structure as a fresh one -- so nothing has to be
 *     re-imported.
 *  2. Rows already sitting in `data_imports.data` render through the shipped
 *     preset with no leftover tags.
 *  3. `ra_output` / `ra_output_tw` hold what the templates expect per quarter.
 *  4. The period variables are computed live and cannot be shadowed by a stale
 *     `users.metadata` entry.
 *
 * Run: bun scripts/verify-etpp.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { dataImports, users } from "../lib/db/schema";
import { ekinerjaHtmlParser } from "../lib/imports/parsers/ekinerja/html";
import {
  dialogPeriode,
  formatBulanIni,
  formatNamaBulan,
  formatNamaHari,
  formatTanggalIni,
  formatTahunIni,
  resolveImportVars,
} from "../lib/imports/variables";
import { DEFAULT_TIMEZONE as WIB, triwulanOf } from "../lib/imports/utils";
import { extractEtppVariables } from "../lib/users/etpp-extract";
import { templateEngine } from "../lib/template-engine";
import { ETPP_PRESET } from "../lib/templates/etpp-preset";
import type { ImportItem } from "../lib/imports/types";

/**
 * Mid-TW3 (August). Named by quarter, not by month, so the label cannot drift
 * away from what `currentTriwulan` returns -- an earlier revision used
 * 2026-10-08, which is actually TW4.
 */
const TW3 = new Date("2026-08-08T08:00:00+07:00");
/** A date inside TW4, so `ra_output_tw` can be checked against a quarter that
 *  is not the first one. Mid-month keeps it clear of month boundaries. */
const TW4 = new Date("2026-11-15T08:00:00+07:00");
const SCALARS = {
  name: "Preview",
  bulan_ini: "Agustus 2026",
  triwulan_ini: 3,
  dialog_periode: 2,
  dialog_awal: [],
  dialog_akhir: [{}],
};

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
    flatTw: v.ra_output_tw,
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

  // --- 4. ra_output vs ra_output_tw --------------------------------------
  // `ra_output` keeps every quarter; `ra_output_tw` is the current quarter only.
  // Both are checked per-quarter so a filter that happened to hardcode one
  // quarter would fail rather than pass on a single date.
  const perTw = [1, 2, 3, 4].map((tw) => {
    const now = new Date(`2026-${String((tw - 1) * 3 + 2).padStart(2, "0")}-15T08:00:00+07:00`);
    const v = extractEtppVariables(rows, now).variables;
    return {
      tw,
      all: v.ra_output.length,
      cur: v.ra_output_tw.length,
      everyRowIsCurrent: v.ra_output_tw.every((r) => r.tw === tw),
      hasBlankTarget: v.ra_output_tw.some((r) => r.target === "-" || r.target === ""),
      hasBlankSatuan: v.ra_output_tw.some((r) => r.satuan === ""),
      // every current-quarter row must also exist in the full list
      subsetOfAll: v.ra_output_tw.every((r) => v.ra_output.includes(r)),
    };
  });

  check(
    "    ra_output_tw is only the quarter in progress",
    perTw.every((r) => r.everyRowIsCurrent && r.subsetOfAll),
    perTw.map((r) => `TW${r.tw}:${r.cur}/${r.all}`).join(" ")
  );
  check(
    "    no placeholder targets or missing satuan in ra_output_tw",
    perTw.every((r) => !r.hasBlankTarget && !r.hasBlankSatuan)
  );
  check(
    "    every quarter contributes rows (not hardcoded to one quarter)",
    perTw.every((r) => r.cur > 0)
  );
}

// --- 5. ra_output_tw rendering --------------------------------------------
console.log("\n=== ra_output_tw render ===");
{
  const rows = (stored[0]?.data ?? []) as ImportItem[];
  const { variables } = extractEtppVariables(rows, TW4);
  const tpl = `{{#if ra_output_tw.length}}{{#each ra_output_tw}}• _[{{kode_sumber}}] Output RA:_ {{output_ra}}
   _Target TW{{tw}}:_ {{target}} {{satuan}}{{#if realisasi}} | _Realisasi:_ {{realisasi}}{{/if}}{{#if validasi}} | _Validasi:_ {{validasi}}{{/if}}
{{/each}}{{#else}}⚠️ Belum ada output di triwulan ini.{{/if}}`;
  const out = templateEngine.render(tpl, { ...variables, triwulan_ini: 4 });
  console.log(out);
  check(
    "renders without leftover tags",
    !/\{\{[^}]+\}\}/.test(out),
    `${variables.ra_output_tw.length} rows, ${out.length} chars`
  );
}

// --- 6. dialog_periode is a half-month, not a semester --------------------
// The e-TPP cron fires on the 5th and the 25th, so the variable that tells a
// template which window it is looking at has to be days 1-15 vs 16-31. It used
// to come from the triwulan, which put the 25th of TW2 in "periode 1".
console.log("\n=== dialog_periode ===");
{
  // December: the only month long enough to probe day 31. November would roll
  // 11-31 over into December and quietly report day 1.
  const at = (day: number, month = 12) =>
    new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T08:00:00+07:00`);

  const boundary = [1, 14, 15, 16, 17, 25, 30, 31].map((d) => ({
    d,
    p: dialogPeriode(at(d), WIB),
  }));
  check(
    "days 1-15 are periode 1, days 16-31 are periode 2",
    boundary.every((r) => r.p === (r.d <= 15 ? 1 : 2)),
    boundary.map((r) => `${r.d}:${r.p}`).join(" ")
  );

  // The regression the triwulan-based version had.
  const twentyFifthOfTw2 = at(25, 5);
  check(
    "the 25th of TW2 is periode 2 (the triwulan-based version said 1)",
    dialogPeriode(twentyFifthOfTw2, WIB) === 2,
    `TW${triwulanOf(twentyFifthOfTw2, WIB)} / ${new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: WIB }).format(twentyFifthOfTw2)}`
  );

  // The two cron windows must land on opposite sides.
  check(
    "the cron's own days (5 and 25) are on opposite sides",
    dialogPeriode(at(5), WIB) === 1 && dialogPeriode(at(25), WIB) === 2
  );

  // The engine has no `==` and treats 1 and 2 alike as truthy, so the branchable
  // pair has to be exactly one row on one side and empty on the other.
  const [early] = await db
    .select({ id: users.id, adminId: users.adminId, name: users.name, metadata: users.metadata })
    .from(users)
    .limit(1);
  if (early) {
    const p1 = await resolveImportVars(early, undefined, at(5), WIB);
    const p2 = await resolveImportVars(early, undefined, at(25), WIB);
    const rows = (v: Record<string, unknown>, key: string): number =>
      ((v[key] as unknown[]) || []).length;
    check(
      "dialog_awal / dialog_akhir are one row on one side, empty on the other",
      rows(p1, "dialog_awal") === 1 &&
        rows(p1, "dialog_akhir") === 0 &&
        rows(p2, "dialog_awal") === 0 &&
        rows(p2, "dialog_akhir") === 1,
      `tgl5: awal=${rows(p1, "dialog_awal")} akhir=${rows(p1, "dialog_akhir")} | tgl25: awal=${rows(p2, "dialog_awal")} akhir=${rows(p2, "dialog_akhir")}`
    );
    const rendered = templateEngine.render(
      "{{#if dialog_awal.length}}AWAL{{/if}}{{#if dialog_akhir.length}}AKHIR{{/if}}",
      p2
    );
    check("a template can branch on it", rendered === "AKHIR", `tgl25 renders "${rendered}"`);
  }
}

// --- 7. Period variables are timezone-correct ------------------------------
// `dialog_periode` flips on a single day, so reading the day in the host zone
// would put a UTC container a whole half-month out during the small hours WIB.
console.log("\n=== timezone ===");
{
  // 2026-12-31 17:00 UTC is 2027-01-01 00:05 WIB: still December in UTC,
  // already the new year -- and the new month's first day, in WIB.
  const newYearWib = new Date("2026-12-31T17:00:00Z");
  check(
    "year and month are read in WIB, not the host zone",
    formatTahunIni(newYearWib, WIB) === "2027" &&
      formatNamaBulan(newYearWib, WIB) === "Januari" &&
      formatBulanIni(newYearWib, WIB) === "Januari 2027" &&
      // the host zone reads the same instant as December
      formatBulanIni(newYearWib, "UTC") === "Desember 2026",
    `WIB says ${formatBulanIni(newYearWib, WIB)}, UTC says ${formatBulanIni(newYearWib, "UTC")}`
  );

  // The 15/16 cutoff happens at 00:00 WIB, which is 17:00 UTC the day before.
  // One second either side of it must fall on opposite sides, and a host that
  // is not WIB would read both instants as the 15th.
  const beforeCutoff = new Date("2026-11-15T16:59:00Z"); // 23:59 WIB, still the 15th
  const afterCutoff = new Date("2026-11-15T17:01:00Z"); // 00:01 WIB, now the 16th
  check(
    "the day is read in WIB, so the 15/16 cutoff lands correctly",
    dialogPeriode(beforeCutoff, WIB) === 1 && dialogPeriode(afterCutoff, WIB) === 2,
    `23:59 WIB (15th) -> ${dialogPeriode(beforeCutoff, WIB)}, 00:01 WIB (16th) -> ${dialogPeriode(afterCutoff, WIB)}`
  );

  // A bad `DEFAULT_TIMEZONE` in the environment must not kill the send: Intl
  // throws a RangeError rather than degrading, so every formatter resolves the
  // zone first.
  check(
    "an unknown timezone falls back instead of throwing mid-send",
    formatBulanIni(newYearWib, "Not/AZone") === formatBulanIni(newYearWib, WIB) &&
      dialogPeriode(afterCutoff, "Not/AZone") === dialogPeriode(afterCutoff, WIB)
  );
}

// --- 8. Period variables are live -----------------------------------------
// The e-TPP export carries no document year, so every period variable is
// derived from `now` at send time. Two things have to hold for that to be worth
// anything: the pieces have to be right, and a value snapshotted into
// `users.metadata` at import time must not win over the live one.
console.log("\n=== period variables ===");
{
  const now = new Date("2026-11-15T08:00:00+07:00");
  check(
    "period pieces are correct for 2026-11-15",
    formatBulanIni(now) === "November 2026" &&
      formatTahunIni(now) === "2026" &&
      formatNamaBulan(now) === "November" &&
      formatNamaHari(now) === "Minggu" &&
      formatTanggalIni(now) === "15",
    `${formatBulanIni(now)} / ${formatNamaHari(now)}`
  );

  // Year has to roll over on its own, which a stored value never would.
  const lastYear = new Date("2026-12-31T23:59:00+07:00");
  const newYear = new Date("2027-01-01T00:01:00+07:00");
  check(
    "tahun_ini rolls over between 2026-12-31 and 2027-01-01",
    formatTahunIni(lastYear) === "2026" && formatTahunIni(newYear) === "2027",
    `${formatTahunIni(lastYear)} -> ${formatTahunIni(newYear)}`
  );

  // `mergeVariables` spreads `metadata` over the user defaults, so anything left
  // in a user's metadata from an earlier send would shadow these if they were
  // placed on the other side of that spread.
  const [sampleUser] = await db
    .select({ id: users.id, adminId: users.adminId, name: users.name, metadata: users.metadata })
    .from(users)
    .limit(1);

  if (sampleUser) {
    const stale = await resolveImportVars(
      {
        ...sampleUser,
        metadata: {
          bulan_ini: "Agustus 2020",
          tahun_ini: "2020",
          nama_bulan: "Agustus",
          nama_hari: "Sabtu",
          tanggal_ini: "1",
        },
      },
      undefined,
      now,
      WIB
    );
    check(
      "stale users.metadata cannot shadow the live period variables",
      stale.tahun_ini === "2026" &&
        stale.nama_bulan === "November" &&
        stale.bulan_ini === "November 2026" &&
        stale.tanggal_ini === "15",
      `metadata said 2020/${String(stale.nama_bulan)} -> got ${stale.tahun_ini}/${String(stale.nama_bulan)}`
    );
  } else {
    console.log("  (no user row to test metadata shadowing against)");
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
