import { submitResend, type ResendResult } from "./client";
import type { ResendGate } from "./limiter";

export interface ResendDeliveryStore {
  prepare(body: Record<string, unknown>): Promise<{ body: Record<string, unknown>; sent: boolean; messageId: string }>;
  markAttempt(): Promise<void | (() => Promise<void>)>;
  record(state: "sent" | "pending", error?: string, messageId?: string): Promise<void>;
}

export async function deliverResend(
  body: Record<string, unknown>, key: string, apiKey: string, gate: ResendGate,
  store?: ResendDeliveryStore, http: typeof fetch = fetch,
): Promise<ResendResult> {
  try {
    const prepared = store ? await store.prepare(body) : null;
    if (prepared?.sent) {
      // Also repair a legacy failed/pending log that already has an email ID.
      await store!.record("sent", undefined, prepared.messageId);
      return { provider: "resend", id: prepared.messageId, success: true };
    }
    const result = await submitResend(prepared?.body || body, key, apiKey, gate,
      store ? () => store.markAttempt() : undefined, http);
    if (store) await store.record(result.success ? "sent" : "pending", result.error, result.id);
    return result;
  } catch (error) {
    // A failed DB write after API acceptance must reuse the frozen payload/key
    // on the next queue attempt. Never generate a new key or retry HTTP here.
    return {
      provider: "resend", id: "", success: false, failureKind: "temporary",
      error: error instanceof Error ? error.message : "Resend delivery unavailable",
    };
  }
}
