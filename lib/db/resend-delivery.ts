import { and, eq, sql } from "drizzle-orm";
import { db } from ".";
import { notificationLogs } from "./schema";
import { RESEND_RETRY_WINDOW_MS, ResendWindowExpiredError } from "../resend/client";
import { randomUUID } from "node:crypto";

function identity(adminId: string, logId: string) {
  return and(eq(notificationLogs.id, logId), eq(notificationLogs.adminId, adminId), eq(notificationLogs.channel, "email"));
}

export async function prepareResendDelivery(adminId: string, logId: string, body: Record<string, unknown>) {
  // Freeze the exact API payload: sender settings/template edits during a retry
  // must not turn the same idempotency key into a different request.
  await db.update(notificationLogs).set({
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || ${JSON.stringify({ resendPayload: body })}::jsonb`,
  }).where(and(identity(adminId, logId), sql`${notificationLogs.metadata}->'resendPayload' IS NULL`));
  const [log] = await db.select().from(notificationLogs).where(identity(adminId, logId)).limit(1);
  if (!log) throw new Error("Resend delivery log not found");
  const payload = log.metadata?.resendPayload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid frozen Resend payload; refusing to change an existing request");
  }
  return {
    body: payload as Record<string, unknown>,
    // Legacy worker could persist an API email ID and then fail its final
    // status write. That ID is still evidence of acceptance: do not resend.
    sent: ["sent", "delivered", "read"].includes(log.status || "") || log.metadata?.resendState === "sent"
      || (typeof log.metadata?.resendEmailId === "string" && log.metadata.resendEmailId.length > 0),
    messageId: typeof log.metadata?.resendEmailId === "string" ? log.metadata.resendEmailId : "",
  };
}

export async function markResendAttempt(adminId: string, logId: string) {
  // Atomic first-attempt timestamp survives crashes/restarts and is never
  // extended by retries. Old ambiguous sends cannot escape the 24h API guard.
  const token = randomUUID();
  const [log] = await db.update(notificationLogs).set({
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || jsonb_build_object(
      'resendFirstAttemptAt', coalesce(${notificationLogs.metadata}->'resendFirstAttemptAt', to_jsonb(${new Date().toISOString()}::text)),
      'resendWindowToken', coalesce(${notificationLogs.metadata}->'resendWindowToken',
        to_jsonb((CASE WHEN ${notificationLogs.metadata}->'resendFirstAttemptAt' IS NULL THEN ${token} ELSE 'legacy' END)::text)),
      'resendActiveAttemptToken', ${token}::text
    )`,
  }).where(identity(adminId, logId)).returning({ metadata: notificationLogs.metadata });
  const first = Date.parse(String(log?.metadata?.resendFirstAttemptAt || ""));
  if (!Number.isFinite(first) || Date.now() - first >= RESEND_RETRY_WINDOW_MS) {
    throw new ResendWindowExpiredError("Batas retry aman Resend sudah lewat; periksa dashboard Resend sebelum membuat pengiriman baru.");
  }
  if (log.metadata?.resendWindowToken !== token) return;
  // A brand-new intent may be undone ONLY when no HTTP request happened, or a
  // definitive rejection occurred. Never clear a previous ambiguous attempt's
  // window, and never clear it if a concurrent processor has touched this log.
  return async () => {
    await db.update(notificationLogs).set({
      metadata: sql`${notificationLogs.metadata} - 'resendFirstAttemptAt' - 'resendWindowToken' - 'resendActiveAttemptToken'`,
    }).where(and(
      identity(adminId, logId),
      sql`${notificationLogs.metadata}->>'resendWindowToken' = ${token}`,
      sql`${notificationLogs.metadata}->>'resendActiveAttemptToken' = ${token}`,
      sql`${notificationLogs.status} NOT IN ('sent', 'delivered', 'read')`,
    ));
  };
}

export async function recordResendDelivery(
  adminId: string, logId: string, state: "pending" | "sent" | "failed", error?: string, messageId?: string,
) {
  const metadata = JSON.stringify({ resendState: state, ...(messageId ? { resendEmailId: messageId } : {}) });
  await db.update(notificationLogs).set({
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || ${metadata}::jsonb`,
    status: state,
    error: error || null,
    ...(state === "sent" ? { sentAt: sql`coalesce(${notificationLogs.sentAt}, now())` } : {}),
  }).where(and(identity(adminId, logId), state === "sent"
    ? sql`${notificationLogs.status} NOT IN ('delivered', 'read')`
    : sql`${notificationLogs.status} NOT IN ('sent', 'delivered', 'read')`));
}
