import type { Locale } from "@/lib/i18n/context";
import { CronExpressionParser } from "cron-parser";

export interface CronValidation {
  valid: boolean;
  error?: string;
}

export function validateCron(expression: string): CronValidation {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: "parts" };
  }
  try {
    CronExpressionParser.parse(expression.trim());
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "invalid" };
  }
}

export function getNextRun(expression: string, timezone = "Asia/Jakarta"): Date | null {
  try {
    return CronExpressionParser.parse(expression.trim(), { tz: timezone })
      .next()
      .toDate();
  } catch {
    return null;
  }
}

const WEEKDAYS: Record<Locale, string[]> = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function expandField(field: string, max: number): number[] {
  if (field === "*") return [];
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step <= 0) return [];
    const values: number[] = [];
    for (let i = 0; i < max; i += step) values.push(i);
    return values;
  }
  const values = new Set<number>();
  for (const part of field.split(",")) {
    if (!part.trim()) continue;
    const range = part.split("-");
    const start = parseInt(range[0], 10);
    const end = range.length > 1 ? parseInt(range[1], 10) : start;
    if (isNaN(start) || isNaN(end)) continue;
    const clampedStart = Math.max(0, start);
    const clampedEnd = Math.min(max - 1, end);
    for (let i = clampedStart; i <= clampedEnd; i++) values.add(i);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function describeTime(hour: string, minute: string, locale: Locale): string {
  if (hour === "*") {
    if (/^\d+$/.test(minute)) {
      return locale === "id"
        ? `setiap jam menit ke-${minute}`
        : `minute ${minute} of every hour`;
    }
    return "";
  }
  const h = parseInt(hour, 10);
  const m = /^\d+$/.test(minute) ? parseInt(minute, 10) : 0;
  return `${pad(isNaN(h) ? 0 : h)}:${pad(isNaN(m) ? 0 : m)}`;
}

/**
 * Converts a 5-field cron expression into a human-readable description.
 * Falls back to the raw expression when the pattern is not recognized.
 */
export function describeCron(expression: string, locale: Locale = "id"): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [minute, hour, day, month, dayOfWeek] = parts;

  if (minute === "*" && hour === "*") {
    return locale === "id" ? "Setiap menit" : "Every minute";
  }
  if (minute === "0" && hour === "*") {
    return locale === "id" ? "Setiap jam" : "Every hour";
  }
  if (minute.startsWith("*/") && hour === "*") {
    const n = minute.slice(2);
    return locale === "id" ? `Setiap ${n} menit` : `Every ${n} minutes`;
  }

  const time = describeTime(hour, minute, locale);

  if (day === "*" && month === "*" && dayOfWeek === "*") {
    return locale === "id" ? `Setiap hari pukul ${time}` : `Every day at ${time}`;
  }

  if (dayOfWeek !== "*") {
    const days = expandField(dayOfWeek, 7);
    if (days.length === 0) return expression;
    if (days.length === 5 && days.join(",") === "1,2,3,4,5") {
      return locale === "id"
        ? `Setiap hari kerja pukul ${time}`
        : `Every weekday at ${time}`;
    }
    const names = days.map((d) => WEEKDAYS[locale][d]);
    return locale === "id"
      ? `Setiap ${names.join(", ")} pukul ${time}`
      : `Every ${names.join(", ")} at ${time}`;
  }

  if (day !== "*") {
    const dayParts = day.split(",").map((p) => p.trim()).filter(Boolean);
    if (dayParts.includes("L")) {
      const endLabel =
        locale === "id" ? "akhir bulan" : "the last day of the month";
      const others = dayParts
        .filter((p) => p !== "L")
        .map((p) => parseInt(p, 10))
        .filter((n) => !isNaN(n));
      if (others.length === 0) {
        return locale === "id"
          ? `Setiap akhir bulan pukul ${time}`
          : `On ${endLabel} at ${time}`;
      }
      const dayLabel =
        locale === "id"
          ? `tanggal ${others.join(", ")}`
          : `days ${others.join(", ")}`;
      return locale === "id"
        ? `Setiap ${dayLabel} & akhir bulan pukul ${time}`
        : `On ${dayLabel} and ${endLabel} at ${time}`;
    }
    const days = expandField(day, 31);
    if (days.length > 0) {
      return locale === "id"
        ? `Setiap tanggal ${days.join(", ")} pukul ${time}`
        : `On days ${days.join(", ")} at ${time}`;
    }
  }

  return expression;
}
