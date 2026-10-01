import { db } from "@/lib/db";
import { dataImports, importCategories } from "@/lib/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { mergeVariables } from "@/lib/variables";
import { extractEtppVariables } from "@/lib/users/etpp-extract";
import { isEmptyRealisasi } from "./utils";
import type { ImportItem } from "./types";
import type { User } from "@/types";

/**
 * The e-TPP import engine. The notification variables are derived from it
 * directly instead of by import category, so which category an admin happened
 * to file the file under cannot break a template.
 */
export const ETPP_ENGINE = "ekinerja-json";

function currentTriwulan(now: Date): number {
  return Math.floor((now.getMonth() + 1 - 1) / 3) + 1;
}

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
export function formatBulanIni(now: Date): string {
  return now.toLocaleString("id-ID", { month: "long", year: "numeric" });
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
) {
  const tw = currentTriwulan(now);
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
  now: Date = new Date()
): Promise<Record<string, unknown>> {
  // `bulan_ini` is spread after `mergeVariables` on purpose: `mergeVariables`
  // lets `metadata` override the user defaults, so a value stored at import
  // time would win and defeat the point of computing it live.
  const triwulanIni = currentTriwulan(now);
  const base: Record<string, unknown> = {
    ...mergeVariables(user as User, custom),
    bulan_ini: formatBulanIni(now),
    triwulan_ini: triwulanIni,
    dialog_periode: triwulanIni <= 2 ? 1 : 2,
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
    Object.assign(base, extractEtppVariables(items, now).variables, {
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
    );
  }

  return { ...base, imports };
}
