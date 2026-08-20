import { db } from "@/lib/db";
import { dataImports, importCategories } from "@/lib/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { mergeVariables } from "@/lib/variables";
import { isEmptyRealisasi } from "./utils";
import type { ImportItem } from "./types";
import type { User } from "@/types";

function currentTriwulan(now: Date): number {
  return Math.floor((now.getMonth() + 1 - 1) / 3) + 1;
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
) {
  const tw = currentTriwulan(new Date());
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
 */
export async function resolveImportVars(
  user: { id: string; adminId: string } & Partial<User>,
  custom?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const base = mergeVariables(user as User, custom);

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
    .orderBy(sql`CASE WHEN ${dataImports.userId} IS NOT NULL THEN 0 ELSE 1 END`);

  if (rows.length === 0) return base;

  const tw = currentTriwulan(new Date());
  const imports: Record<string, unknown> = {};

  for (const row of rows) {
    const key = row.categoryKey;

    if (imports[key]) continue;

    imports[key] = buildImportVars(
      row.imp as { fileName: string; period: string | null; data: Record<string, unknown>[]; summary: Record<string, unknown>; engine: string },
      key,
      row.categoryName,
    );
  }

  return { ...base, imports };
}
