import { db } from "@/lib/db";
import { dataImports, importCategories } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
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

/**
 * Builds template variables for a user, exposing their data imports as
 * `imports.<key>.<field>` (name, fileName, period, summary, currentTw,
 * pendingCount, pendingList, currentTwCount, currentTwList).
 * Pending/current lists are computed at render time for the running triwulan.
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
      and(eq(dataImports.userId, user.id), eq(dataImports.adminId, user.adminId))
    );

  if (rows.length === 0) return base;

  const tw = currentTriwulan(new Date());
  const imports: Record<string, unknown> = {};

  for (const row of rows) {
    const imp = row.imp;
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

    imports[row.categoryKey] = {
      name: row.categoryName,
      key: row.categoryKey,
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

  return { ...base, imports };
}
