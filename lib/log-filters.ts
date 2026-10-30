import { logFilterSchema } from "@/lib/validations";

export function parseLogFilters(params: URLSearchParams) {
  return logFilterSchema.parse(Object.fromEntries(
    [...params.entries()].filter(([, value]) => value !== "")
  ));
}

// Date-only inputs are calendar days in WIB, independent of the server timezone.
// Keep ISO datetime inputs supported for existing API clients.
export function logDateBoundary(value: string, end = false) {
  if (value.length !== 10) return { date: new Date(value), exclusive: false };
  const date = new Date(`${value}T00:00:00+07:00`);
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return { date, exclusive: end };
}
