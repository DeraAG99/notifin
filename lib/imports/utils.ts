import type { ImportItem } from "./types";

export function cleanCellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function trimStr(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

export function nullableStr(value: string | null | undefined): string | null {
  const s = trimStr(value);
  if (s === null || s === "-" || s === "--" || s === "0") return null;
  return s;
}

export function isEmptyRealisasi(value: string | null | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    value.trim() === "" ||
    value.trim() === "-"
  );
}

export function buildSummary(items: ImportItem[]): {
  itemCount: number;
  pendingPerTriwulan: Record<number, number>;
} {
  const pendingPerTriwulan: Record<number, number> = {};
  for (let tw = 1; tw <= 4; tw++) {
    pendingPerTriwulan[tw] = items.filter(
      (item) => item.triwulan === tw && isEmptyRealisasi(item.realisasi)
    ).length;
  }
  return { itemCount: items.length, pendingPerTriwulan };
}

export function slugifyKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug || "import";
}

export function extractImportKeys(text: string): string[] {
  const keys = new Set<string>();
  const regex = /\{\{\s*(?:#if\s+)?imports\.([\w.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].split(".")[0];
    if (key) keys.add(key);
  }
  return Array.from(keys);
}
