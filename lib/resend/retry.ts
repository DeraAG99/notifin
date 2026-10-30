import type { ResendResult } from "./client";

export interface ResendRetryState { failures?: number; deferrals?: number }

/** Queue is the only retry owner. Rate-limit waits don't consume send attempts. */
export function resendRetryDecision(result: ResendResult, state: ResendRetryState, now = Date.now()) {
  if (result.success) return { action: "done" as const };
  if (result.failureKind === "permanent" || result.failureKind === "monthly_quota") {
    return { action: "fail" as const };
  }
  if (result.failureKind === "rate_limit" || result.failureKind === "daily_quota") {
    const deferrals = (state.deferrals || 0) + 1;
    if (deferrals > 120) return { action: "fail" as const };
    return { action: "delay" as const, retryAt: Math.max(now + 1000, result.retryAt || now + 5000), state: { ...state, deferrals } };
  }
  const failures = (state.failures || 0) + 1;
  if (failures >= 3) return { action: "fail" as const };
  return {
    action: "delay" as const,
    retryAt: Math.max(result.retryAt || 0, now + 5000 * 2 ** (failures - 1)),
    state: { ...state, failures },
  };
}
