import { createWorker, QUEUE_NAMES, type NotificationJobData } from "../lib/queue";
import { db } from "../lib/db";
import { notificationLogs } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { getFonnteClient } from "../lib/fonnte";
import { sendEmail } from "../lib/email";
import { templateEngine } from "../lib/template-engine";
import { db as dbDirect } from "../lib/db";

async function processNotification(job: { id?: string | number; data: NotificationJobData }) {
  const { data } = job;
  console.log(`Processing job ${job.id}: ${data.type} for user ${data.userId}`);

  try {
    if (data.channel === "wa") {
      await processWhatsApp(data);
    } else {
      await processEmail(data);
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

  const fonnte = getFonnteClient();
  const result = await fonnte.sendText(data.recipientPhone, data.content.text);

  if (!result.status) {
    throw new Error(result.message || "Failed to send WhatsApp message");
  }

  if (data.logId && result.data?.id) {
    await db
      .update(notificationLogs)
      .set({
        metadata: {
          fonnteMessageId: result.data.id,
          sentAt: new Date().toISOString(),
        },
      })
      .where(eq(notificationLogs.id, data.logId));
  }
}

async function processEmail(data: NotificationJobData) {
  if (!data.recipientEmail) {
    throw new Error("No email address for email notification");
  }

  const result = await sendEmail({
    to: data.recipientEmail,
    subject: data.subject || "Notification",
    html: data.content.html || data.content.text,
    text: data.content.text,
  });

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

  console.log(`WA worker concurrency: 10`);
  console.log(`Email worker concurrency: 20`);
  console.log("Workers are running. Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\nShutting down workers...");
    await waWorker.close();
    await emailWorker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exit(1);
});
