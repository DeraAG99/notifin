import type { ImportItem } from "./types";

/**
 * Timezone the notification text is written in.
 *
 * Everything that decides a calendar fact has to be read in this zone, not in
 * the container's: a server running UTC would call 2026-07-01 01:00 WIB
 * "30 June" and land in the previous triwulan, and `dialog_periode` would flip
 * a whole half-month early.
 */
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Jakarta";

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone to actually format with, or `DEFAULT_TIMEZONE` if the caller passed
 * something `Intl` will reject.
 *
 * Every formatter has to go through this: `Intl.DateTimeFormat` throws a
 * `RangeError` on a bad zone rather than degrading, and a notification send
 * must not die on a bad `DEFAULT_TIMEZONE` in the environment.
 */
export function resolveTimezone(timezone?: string): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  return isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

export interface CalendarParts {
  year: number;
  /** 1-12, unlike `Date.getMonth()`. */
  month: number;
  /** 1-31, unlike `Date.getDate()`'s dependency on the host zone. */
  day: number;
}

/**
 * The wall clock in `timezone` at the instant `now`.
 *
 * Deliberately not `new Date(now.toLocaleString("en-US", { timeZone }))`:
 * that re-parses a formatted string in the host zone, so the result depends on
 * the host locale, and any ICU formatting difference (narrow no-break space,
 * a missing hour field) turns it into an Invalid Date. Reading the parts off
 * an `Intl` formatter has no such failure mode.
 *
 * Falls back to UTC if the zone is unknown rather than throwing mid-send.
 */
export function calendarParts(now: Date, timezone?: string): CalendarParts {
  const zone = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: "year" | "month" | "day"): number =>
    Number(parts.find((p) => p.type === type)?.value);

  return { year: get("year"), month: get("month"), day: get("day") };
}

/** 1-4, from the month in `timezone`. */
export function triwulanOf(now: Date, timezone?: string): number {
  return Math.floor((calendarParts(now, timezone).month - 1) / 3) + 1;
}

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

export function buildSummary(
  items: ImportItem[],
  etppSkippedNoKode = 0
): {
  itemCount: number;
  pendingPerTriwulan: Record<number, number>;
  /**
   * e-TPP rows dropped for having no usable `kode_sumber`. Kept on the import
   * row rather than on the user because it is an audit trail for one file, not
   * a variable any template renders -- per-user audit is a query over
   * `data_imports.summary`.
   */
  etppSkippedNoKode: number;
} {
  const pendingPerTriwulan: Record<number, number> = {};
  for (let tw = 1; tw <= 4; tw++) {
    pendingPerTriwulan[tw] = items.filter(
      (item) => item.triwulan === tw && isEmptyRealisasi(item.realisasi)
    ).length;
  }
  return { itemCount: items.length, pendingPerTriwulan, etppSkippedNoKode };
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
  const regex = /\{\{\s*(?:#(?:if|each)\s+)?imports\.([\w.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].split(".")[0];
    if (key) keys.add(key);
  }
  return Array.from(keys);
}
