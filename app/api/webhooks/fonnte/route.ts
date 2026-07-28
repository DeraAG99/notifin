import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs } from "@/lib/db/schema";
import { fonnteWebhookSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { getFonnteClient } from "@/lib/fonnte";
import type { ApiResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = fonnteWebhookSchema.parse(body);

    const fonnte = getFonnteClient();
    const webhookData = await fonnte.handleWebhook(body);

    if (webhookData.type === "status" && webhookData.messageId) {
      const statusMap: Record<string, "sent" | "delivered" | "failed" | "read"> = {
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
      };

      const newStatus = statusMap[webhookData.status || ""] || "sent";

      const [existingLog] = await db
        .select()
        .from(notificationLogs)
        .where(eq(notificationLogs.id, webhookData.messageId))
        .limit(1);

      if (existingLog) {
        await db
          .update(notificationLogs)
          .set({
            status: newStatus,
            ...(newStatus === "delivered" ? { deliveredAt: new Date() } : {}),
            metadata: {
              ...((existingLog.metadata as Record<string, unknown>) || {}),
              fonnteStatus: webhookData.status,
              webhookReceivedAt: new Date().toISOString(),
            },
          })
          .where(eq(notificationLogs.id, webhookData.messageId));
      }
    }

    if (webhookData.type === "message") {
      console.log(`Incoming WA message from ${webhookData.phone}: ${webhookData.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fonnte webhook error:", error);
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
