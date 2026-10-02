import { db } from "@/lib/db";
import { dataImports, importCategories } from "@/lib/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { mergeVariables } from "@/lib/variables";
import { extractEtppVariables } from "@/lib/users/etpp-extract";
import {
  DEFAULT_TIMEZONE,
  isEmptyRealisasi,
  resolveTimezone,
  triwulanOf,
} from "./utils";
import type { ImportItem } from "./types";
import type { User } from "@/types";

/**
 * The e-TPP import engine. The notification variables are derived from it
 * directly instead of by import category, so which category an admin happened
 * to file the file under cannot break a template.
 */
export const ETPP_ENGINE = "ekinerja-json";

/**
 * Month label for notification text, e.g. "September 2026".
 *
 * Live by design: the e-TPP export carries no document period ("Tahun
 * Kinerja" is a datepicker input, its value is not in the HTML), so a month
 * captured at import time goes stale. A user who imports once in September and
 * never again would otherwise still be told "Memasuki bulan September 2026" in
 * December. Computing it here rather than in each caller covers all five
 * render paths -- cron, test send, batch, preview and the generic scheduler --
 * and, because it lands after `mergeVariables`, it also overwrites a stale
 * `bulan_ini` already sitting in `users.metadata` without a backfill.
 */
export function formatBulanIni(now: Date, timezone?: string): string {
  return now.toLocaleString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: resolveTimezone(timezone),
  });
}

/**
 * The rest of the period pieces `formatBulanIni` already derives, split out
 * individually so a template can compose its own wording ("Rekap Kinerja
 * {{nama_bulan}} {{tahun_ini}}", "Per {{tanggal_ini}}") instead of being locked
 * into the one string `bulan_ini` produces.
 *
 * Every one of these is computed from `now` at send time for the same reason as
 * `bulan_ini`: nothing in the e-TPP export records the document year ("Tahun
 * Kinerja" is a datepicker input), so a value captured at import time goes
 * stale for anyone who imports once and never again.
 *
 * `timezone` is threaded through so these agree with `triwulan_ini` and
 * `dialog_periode`; omit it and `Intl` falls back to the host zone.
 */
export function formatTahunIni(now: Date, timezone?: string): string {
  return now.toLocaleString("id-ID", {
    year: "numeric",
    timeZone: resolveTimezone(timezone),
  });
}

export function formatNamaBulan(now: Date, timezone?: string): string {
  return now.toLocaleString("id-ID", {
    month: "long",
    timeZone: resolveTimezone(timezone),
  });
}

export function formatNamaHari(now: Date, timezone?: string): string {
  return now.toLocaleString("id-ID", {
    weekday: "long",
    timeZone: resolveTimezone(timezone),
  });
}

export function formatTanggalIni(now: Date, timezone?: string): string {
  return now.toLocaleString("id-ID", {
    day: "numeric",
    timeZone: resolveTimezone(timezone),
  });
}

/**
 * Which half of the month the notification lands in: days 1-15 are periode 1,
 * days 16-31 are periode 2.
 *
 * The e-TPP cron fires on the 5th and the 25th (`0 8 5,25 * *`), so this is
 * what tells a template which of the two windows it is looking at. It used to
 * be derived from the triwulan (`triwulan_ini <= 2 ? 1 : 2`), which was simply
 * wrong: TW1 and TW2 both returned 1, so a reminder sent on the 25th of TW2
 * still announced "periode 1".
 *
 * `tanggal_ini` is read in the same timezone as the day, otherwise a UTC host
 * would call the 1st of the month at 01:00 WIB "the last day of the previous
 * month" and land on the wrong half.
 */
export function dialogPeriode(now: Date, timezone?: string): number {
  const day = Number(
    now.toLocaleString("en-GB", {
      day: "numeric",
      timeZone: resolveTimezone(timezone),
    })
  );
  return day <= 15 ? 1 : 2;
}

function formatEkinerjaLine(item: ImportItem, idx: number): string {
  const satuan = item.satuan
    ? ` (${item.satuan}${item.targetValue ? `: ${item.targetValue}` : ""})`
    : "";
  return `${idx + 1}. ${item.output}${satuan}`;
}

function formatTableLine(item: ImportItem, idx: number): string {
  const parts: string[] = [];
  if (item.targetValue) parts.push(`Target ${item.targetValue}`);
  if (item.realisasi) parts.push(`Realisasi ${item.realisasi}`);
  if (item.capaian) parts.push(`Capaian ${item.capaian}`);
  if (item.validasi) parts.push(`Validasi ${item.validasi}`);
  const suffix = parts.length ? `: ${parts.join(" · ")}` : "";
  return `${idx + 1}. ${item.output}${suffix}`;
}

function buildImportVars(
  imp: { fileName: string; period: string | null; data: Record<string, unknown>[]; summary: Record<string, unknown>; engine: string },
  categoryKey: string,
  categoryName: string,
  now: Date,
  timezone?: string,
) {
  const tw = triwulanOf(now, timezone);
  const items = (Array.isArray(imp.data) ? imp.data : []) as ImportItem[];
  const twItems = items.filter((item) => item.triwulan === tw);
  const pending = twItems.filter((item) => isEmptyRealisasi(item.realisasi));
  const isTable = imp.engine === "table" || imp.engine === "pdukpdxlsx";
  const line = (item: ImportItem, idx: number) =>
    isTable ? formatTableLine(item, idx) : formatEkinerjaLine(item, idx);

  const seenRaw = new Set<string>();
  const rawRows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item.raw) continue;
    const dedupeKey = JSON.stringify(item.raw);
    if (seenRaw.has(dedupeKey)) continue;
    seenRaw.add(dedupeKey);
    rawRows.push({ ...(item.raw as Record<string, string | null>) });
  }

  return {
    name: categoryName,
    key: categoryKey,
    fileName: imp.fileName,
    period: imp.period,
    summary: imp.summary,
    currentTw: tw,
    pendingCount: pending.length,
    pendingList: pending.map(line).join("\n"),
    currentTwCount: twItems.length,
    currentTwList: twItems.map(line).join("\n"),
    rowCount: rawRows.length,
    rows: rawRows,
  };
}

/**
 * Builds template variables for a user, exposing their data imports as
 * `imports.<key>.<field>`.
 *
 * Fallback model: per-user data overrides global data. If a user has a
 * personal import for a category, it is used. Otherwise, the global import
 * for that category is used as fallback.
 *
 * The e-TPP variables are a separate, first-class path: they are rebuilt from
 * the stored `data_imports.data` rows on every call, so one static template
 * serves every user from their own file, and files imported before this
 * behaviour existed need no re-import.
 */
export async function resolveImportVars(
  user: { id: string; adminId: string } & Partial<User>,
  custom?: Record<string, unknown>,
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): Promise<Record<string, unknown>> {
  // The whole period block is spread after `mergeVariables` on purpose:
  // `mergeVariables` lets `metadata` override the user defaults, so a value
  // stored at import time would win and defeat the point of computing these
  // live. Keep every period variable on this side of the spread.
  const triwulanIni = triwulanOf(now, timezone);
  const periode = dialogPeriode(now, timezone);
  const base: Record<string, unknown> = {
    ...mergeVariables(user as User, custom),
    bulan_ini: formatBulanIni(now, timezone),
    tahun_ini: formatTahunIni(now, timezone),
    nama_bulan: formatNamaBulan(now, timezone),
    nama_hari: formatNamaHari(now, timezone),
    tanggal_ini: formatTanggalIni(now, timezone),
    triwulan_ini: triwulanIni,
    dialog_periode: periode,
    // The template engine has no `==` and its truthiness check treats both 1
    // and 2 as true, so `{{#if dialog_periode}}` cannot branch on this. These
    // two carry the same answer in a form the engine can branch on: exactly one
    // holds a single row, the other is empty.
    dialog_awal: periode === 1 ? [{}] : [],
    dialog_akhir: periode === 2 ? [{}] : [],
  };

  const rows = await db
    .select({
      imp: dataImports,
      categoryKey: importCategories.key,
      categoryName: importCategories.name,
    })
    .from(dataImports)
    .innerJoin(importCategories, eq(dataImports.categoryId, importCategories.id))
    .where(
      and(
        eq(dataImports.adminId, user.adminId),
        or(
          eq(dataImports.userId, user.id),
          eq(dataImports.scope, "global")
        )
      )
    )
    .orderBy(
      sql`CASE WHEN ${dataImports.userId} IS NOT NULL THEN 0 ELSE 1 END`,
      desc(dataImports.createdAt)
    );

  const etppRow = rows.find((row) => row.imp.engine === ETPP_ENGINE);
  if (etppRow) {
    const items = Array.isArray(etppRow.imp.data)
      ? (etppRow.imp.data as ImportItem[])
      : [];
    Object.assign(base, extractEtppVariables(items, now, timezone).variables, {
      etpp_imported: true,
    });
  }

  if (rows.length === 0) return base;

  const imports: Record<string, unknown> = {};

  for (const row of rows) {
    const key = row.categoryKey;

    if (imports[key]) continue;

    imports[key] = buildImportVars(
      row.imp as { fileName: string; period: string | null; data: Record<string, unknown>[]; summary: Record<string, unknown>; engine: string },
      key,
      row.categoryName,
      now,
      timezone,
    );
  }

  return { ...base, imports };
}
