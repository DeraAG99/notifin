import { ResendGateWaitError, type ResendGate } from "./limiter";

export type ResendFailure = "rate_limit" | "daily_quota" | "monthly_quota" | "temporary" | "permanent" | "uncertain";
export interface ResendResult {
  id: string;
  success: boolean;
  provider: "resend";
  error?: string;
  failureKind?: ResendFailure;
  retryAt?: number;
}

export class ResendDeliveryError extends Error {
  constructor(readonly result: ResendResult) {
    super(result.error || "Resend delivery failed");
    this.name = "ResendDeliveryError";
  }
}

export class ResendWindowExpiredError extends Error {}
// Leave a one-hour safety margin below Resend's 24h retention window.
export const RESEND_RETRY_WINDOW_MS = 23 * 3600_000;

export function retryAfterMs(header: string | null, now: number, fallback = 5000): number {
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(fallback, Math.ceil(seconds * 1000));
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(fallback, date - now) : fallback;
}

export function nextUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

/** One HTTP attempt. The queue, not this client, owns retries. */
export async function submitResend(
  body: Record<string, unknown>, key: string, apiKey: string, gate: ResendGate,
  beforeSubmit: () => Promise<void | (() => Promise<void>)> = async () => {},
  http: typeof fetch = fetch, now = Date.now,
): Promise<ResendResult> {
  const fail = (failureKind: ResendFailure, error: string, retryAt?: number): ResendResult => ({
    provider: "resend", id: "", success: false, failureKind, error, retryAt,
  });
  let undoNewIntent: void | (() => Promise<void>);
  const confirmedNoSubmission = async () => {
    try { if (undoNewIntent) await undoNewIntent(); }
    catch { /* Keep the conservative window marker if cleanup fails. */ }
  };
  try {
    undoNewIntent = await beforeSubmit();
    // No database/settings work between admission and the HTTP request: slow
    // preflight queries must not bunch previously admitted requests together.
    await gate.take();
  } catch (error) {
    await confirmedNoSubmission();
    if (error instanceof ResendGateWaitError) return fail("rate_limit", error.message, error.retryAt);
    if (error instanceof ResendWindowExpiredError) return fail("permanent", error.message);
    return fail("temporary", error instanceof Error ? error.message : "Resend preflight unavailable", now() + 30_000);
  }
  let response: Response;
  try {
    response = await http("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "Idempotency-Key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    return fail("uncertain", error instanceof Error ? error.message : "Resend network error");
  }
  let data: { id?: string; message?: string; name?: string };
  try {
    const parsed = await response.json();
    data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  catch { data = {}; }
  if (response.ok) {
    return typeof data.id === "string" && data.id
      ? { provider: "resend", id: data.id, success: true }
      : fail("uncertain", "Resend accepted request without a valid email ID");
  }
  const error = data.message || `Resend HTTP ${response.status}`;
  if (response.status === 429) {
    await confirmedNoSubmission();
    const kind = data.name === "daily_quota_exceeded" ? "daily_quota"
      : data.name === "monthly_quota_exceeded" ? "monthly_quota" : "rate_limit";
    const requestedWait = retryAfterMs(response.headers.get("retry-after"), now());
    const wait = kind === "daily_quota" ? Math.max(nextUtcDay(now()) - now() + 1000, requestedWait)
      : kind === "monthly_quota" ? Math.max(3600_000, requestedWait) : requestedWait;
    try { await gate.cooldown(wait); }
    catch { /* Redis failures also stop admission; never bypass the limiter. */ }
    return fail(kind, error, now() + wait);
  }
  if (response.status >= 500 || response.status === 408 || data.name === "concurrent_idempotent_requests") {
    return fail("temporary", error);
  }
  await confirmedNoSubmission();
  return fail("permanent", error);
}
