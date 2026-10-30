import { createWorker, QUEUE_NAMES, type NotificationJobData, type BaileysJobData } from "../lib/queue";
import { db } from "../lib/db";
import { notificationLogs, admins, settings } from "../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getWaProvider } from "../lib/wa";
import { sendEmail } from "../lib/email";
import { isAdminActive } from "../lib/admin-status";
import { DelayedError, UnrecoverableError, type Job } from "bullmq";
import { claimWaDelivery, recordWaDelivery } from "../lib/db/wa-delivery";
import { deliverBaileysOnce, WaDeliveryError } from "../lib/wa/delivery";
import { ResendDeliveryError } from "../lib/resend/client";
import { resendRetryDecision } from "../lib/resend/retry";
import { recordResendDelivery } from "../lib/db/resend-delivery";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDefaultHtml(
  title: string,
  message: string,
  brandName = "SI-MPOK NORI"
): string {
  const brand = escapeHtml(brandName);
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${brand}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:22px;font-weight:600;">${title}</h2>
              <div style="color:#52525b;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center;">Dikirim oleh ${brand}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function getSetting(adminId: string, key: string): Promise<string | number | boolean | null> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(and(eq(settings.adminId, adminId), eq(settings.key, key)));
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function autoConnectBaileys() {
  try {
    const adminRows = await db
      .select({ id: admins.id, isActive: admins.isActive, expiresAt: admins.expiresAt })
      .from(admins);
    const mod = await import("../lib/wa/baileys-manager");
    for (const admin of adminRows) {
      const providerType = await getSetting(admin.id, "waProvider");
      if (providerType !== "baileys") continue;

      // The lease owner clears stale flags. A standby worker must not overwrite
      // the healthy owner's status/QR when multiple workers start together.

      const expired =
        admin.expiresAt && new Date(admin.expiresAt).getTime() < Date.now();
      if (!admin.isActive || expired) {
        console.log(`[Worker] Auto-connect skipped for admin ${admin.id}: inactive or expired`);
        await mod.setBaileysError(admin.id, "Akun admin tidak aktif atau kedaluwarsa");
        continue;
      }

      console.log(`[Worker] Auto-connecting Baileys for admin ${admin.id}...`);
      const manager = mod.BaileysManager.getInstance(admin.id);
      manager.connect().catch((err: Error) => {
        console.error(`[Worker] Baileys auto-connect failed for admin ${admin.id}:`, err.message);
        mod.setBaileysError(admin.id, err.message);
      });
    }
  } catch {
    // silent
  }
}

async function handleBaileysJob(job: { id?: string | number; data: BaileysJobData }) {
  const { adminId, type } = job.data;

  if (type === "baileys-disconnect") {
    console.log(`[Worker] Baileys disconnect job received for admin ${adminId}`);
    try {
      const mod = await import("../lib/wa/baileys-manager");
      await mod.BaileysManager.disconnect(adminId);
    } catch (err) {
      console.error(`[Worker] Baileys disconnect failed for admin ${adminId}:`, err instanceof Error ? err.message : "Unknown error");
    }
    return;
  }

  if (!(await isAdminActive(adminId))) {
    console.log(`Baileys connect job skipped: admin ${adminId} is inactive or expired`);
    const mod = await import("../lib/wa/baileys-manager");
    await mod.setBaileysError(adminId, "Akun admin tidak aktif atau kedaluwarsa");
    return;
  }
  console.log(`[Worker] Baileys connect job received for admin ${adminId}, initiating connection...`);
  try {
    const mod = await import("../lib/wa/baileys-manager");
    const manager = mod.BaileysManager.getInstance(adminId);
    await manager.connect(true);
    console.log(`[Worker] Baileys connect completed for admin ${adminId}, connected:`, manager.isConnected());
  } catch (err) {
    console.error(`[Worker] Baileys connect failed for admin ${adminId}:`, err instanceof Error ? err.message : "Unknown error");
    const mod = await import("../lib/wa/baileys-manager");
    await mod.setBaileysError(adminId, err instanceof Error ? err.message : "Gagal terhubung ke WhatsApp");
  }
}

async function processNotification(job: Job<NotificationJobData>, token?: string) {
  const { data } = job;
  console.log(`Processing job ${job.id}: ${data.type} for user ${data.userId}`);

  try {
    if (!(await isAdminActive(data.adminId))) {
      console.log(`Job ${job.id} skipped: admin ${data.adminId} is inactive or expired`);
      if (data.logId) {
        await db
          .update(notificationLogs)
          .set({
            status: "failed",
            error: "Admin tidak aktif atau kedaluwarsa",
          })
          .where(eq(notificationLogs.id, data.logId));
      }
      return;
    }

    if (data.channel === "wa") {
      const handled = await processWhatsApp(data);
      if (handled) return;
    } else {
      const handled = await processEmail(data);
      if (handled) return;
    }

    if (data.logId) {
      await db
        .update(notificationLogs)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(notificationLogs.id, data.logId));
    }

    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    if (error instanceof ResendDeliveryError) {
      const decision = resendRetryDecision(error.result, data.resendRetry || {});
      if (decision.action === "delay") {
        await job.updateData({ ...data, resendRetry: decision.state });
        await job.moveToDelayed(decision.retryAt, token);
        throw new DelayedError();
      }
      await recordResendDelivery(data.adminId, data.logId, "failed", error.message);
      throw new UnrecoverableError(error.message);
    }

    if (error instanceof WaDeliveryError) {
      if (error.kind === "disconnected") {
        const since = data.waWaitingSince || Date.now();
        if (Date.now() - since < 30 * 60_000) {
          await job.updateData({ ...data, waWaitingSince: since });
          await job.moveToDelayed(Date.now() + 30_000, token);
          throw new DelayedError();
        }
        await recordWaDelivery(data.adminId, data.logId, "failed", "WhatsApp belum terhubung setelah menunggu 30 menit");
        throw new UnrecoverableError("WhatsApp session unavailable for 30 minutes");
      }
      if (error.kind === "permanent" || error.kind === "uncertain") {
        throw new UnrecoverableError(error.message);
      }
      // Only a confirmed pre-submission failure may consume a normal retry.
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        await recordWaDelivery(data.adminId, data.logId, "failed", error.message);
      }
      throw error;
    }

    if (data.logId) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(notificationLogs)
        .set({
          status: "failed",
          error: errorMessage,
        })
        .where(eq(notificationLogs.id, data.logId));
    }

    throw error;
  }
}

async function processWhatsApp(data: NotificationJobData) {
  if (!data.recipientPhone) {
    throw new Error("No phone number for WhatsApp notification");
  }

  const provider = await getWaProvider(data.adminId);
  if (provider.name === "baileys") {
    if (!data.logId) throw new UnrecoverableError("Baileys requires a delivery log ID");
    await deliverBaileysOnce({
      claim: () => claimWaDelivery(data.adminId, data.logId),
      record: (state, error, messageId) => recordWaDelivery(data.adminId, data.logId, state, error, messageId),
    }, () => provider.sendText(data.recipientPhone!, data.content.text));
    return true;
  }
  const result = await provider.sendText(data.recipientPhone, data.content.text);

  if (!result.success) {
    throw new Error(result.error || "Failed to send WhatsApp message");
  }

  if (data.logId && result.messageId) {
    await db
      .update(notificationLogs)
      .set({
        metadata: {
          waMessageId: result.messageId,
          sentAt: new Date().toISOString(),
        },
      })
      .where(eq(notificationLogs.id, data.logId));
  }
}

async function processEmail(data: NotificationJobData) {
  if (!data.logId) throw new UnrecoverableError("Email notification requires a delivery log ID");
  if (!data.recipientEmail) {
    throw new Error("No email address for email notification");
  }

  let html = data.content.html;
  if (!html) {
    const fromName = await getSetting(data.adminId, "emailFromName");
    const brandName = String(fromName ?? "").trim() || "SI-MPOK NORI";
    html = buildDefaultHtml(
      data.subject || "Notifikasi",
      data.content.text,
      brandName
    );
  }

  const result = await sendEmail(data.adminId, {
    to: data.recipientEmail,
    subject: data.subject || "Notification",
    html,
    text: data.content.text,
    deliveryLogId: data.logId,
  });

  if (result.provider === "resend") {
    if (!result.success) throw new ResendDeliveryError({ ...result, provider: "resend" });
    return true; // Resend persisted its result; do not overwrite merged metadata.
  }

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  if (data.logId && result.id) {
    await db
      .update(notificationLogs)
      .set({
        metadata: {
          resendEmailId: result.id,
          sentAt: new Date().toISOString(),
        },
      })
      .where(eq(notificationLogs.id, data.logId));
  }
}

async function main() {
  console.log("Starting notification worker...");

  const waWorker = createWorker(QUEUE_NAMES.whatsapp, processNotification);
  const emailWorker = createWorker(QUEUE_NAMES.email, processNotification);

  const baileysWorker = createWorker(
    QUEUE_NAMES.baileys,
    async (job) => {
      await handleBaileysJob(job as unknown as { id?: string | number; data: BaileysJobData });
    }
  );

  console.log(`WA worker concurrency: 10 (Baileys serialised per session)`);
  console.log(`Email worker concurrency: ${Number(process.env.EMAIL_WORKER_CONCURRENCY) || 5}`);
  console.log("Baileys worker listening for connect jobs");
  console.log("Workers are running. Press Ctrl+C to stop.");

  await autoConnectBaileys();

  const shutdown = async () => {
    console.log("\nShutting down workers...");
    await waWorker.close();
    await emailWorker.close();
    await baileysWorker.close();
    const { BaileysManager } = await import("../lib/wa/baileys-manager");
    await BaileysManager.disconnectAll();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
