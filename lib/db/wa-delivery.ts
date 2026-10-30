import { and, eq, sql } from "drizzle-orm";
import { db } from ".";
import { notificationLogs } from "./schema";

/** The existing log ID is the delivery key; a deliberate new send has a new ID. */
export async function claimWaDelivery(adminId: string, logId: string) {
  const [claimed] = await db.update(notificationLogs).set({
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || '{"waDeliveryState":"sending"}'::jsonb`,
    error: null,
  }).where(and(
    eq(notificationLogs.id, logId),
    eq(notificationLogs.adminId, adminId),
    eq(notificationLogs.channel, "wa"),
    sql`${notificationLogs.status} NOT IN ('sent', 'delivered', 'read')`,
    sql`coalesce(${notificationLogs.metadata}->>'waDeliveryState', 'ready') = 'ready'`,
  )).returning({ id: notificationLogs.id });
  if (claimed) return "claimed" as const;

  const [log] = await db.select().from(notificationLogs).where(and(
    eq(notificationLogs.id, logId), eq(notificationLogs.adminId, adminId),
    eq(notificationLogs.channel, "wa"),
  )).limit(1);
  if (!log) throw new Error("WhatsApp delivery log not found");
  if (["sent", "delivered", "read"].includes(log.status || "")) return "sent" as const;
  if (log.metadata?.waDeliveryState === "sent") return "sent" as const;
  // A crashed worker or concurrent processor may already have submitted it.
  await db.update(notificationLogs).set({
    status: "failed",
    error: "Hasil kirim belum pasti; periksa WhatsApp sebelum mengirim ulang sebagai pengiriman baru.",
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || '{"waDeliveryState":"uncertain"}'::jsonb`,
  }).where(and(
    eq(notificationLogs.id, logId), eq(notificationLogs.adminId, adminId),
    sql`${notificationLogs.metadata}->>'waDeliveryState' = 'sending'`,
    sql`${notificationLogs.status} NOT IN ('sent', 'delivered', 'read')`,
  ));
  return "uncertain" as const;
}

export async function recordWaDelivery(
  adminId: string,
  logId: string,
  state: "ready" | "sent" | "uncertain" | "failed",
  error?: string,
  messageId?: string,
) {
  const metadata = JSON.stringify({
    waDeliveryState: state,
    ...(messageId ? { waMessageId: messageId } : {}),
    ...(state === "sent" ? { sentAt: new Date().toISOString() } : {}),
  });
  await db.update(notificationLogs).set({
    metadata: sql`coalesce(${notificationLogs.metadata}, '{}'::jsonb) || ${metadata}::jsonb`,
    status: state === "sent" ? "sent" : state === "ready" ? "pending" : "failed",
    error: error || null,
    ...(state === "sent" ? { sentAt: new Date() } : {}),
  }).where(and(
    eq(notificationLogs.id, logId), eq(notificationLogs.adminId, adminId),
    eq(notificationLogs.channel, "wa"),
    // A stale failing processor must never downgrade a newer success.
    state === "sent" ? undefined : sql`${notificationLogs.status} NOT IN ('sent', 'delivered', 'read')`,
  ));
}
