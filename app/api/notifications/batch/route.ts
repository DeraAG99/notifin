import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs, notificationTemplates, users } from "@/lib/db/schema";
import { batchSendSchema } from "@/lib/validations";
import { addNotificationJob } from "@/lib/queue";
import { templateEngine } from "@/lib/template-engine";
import { eq, inArray } from "drizzle-orm";
import type { ApiResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = batchSendSchema.parse(body);

    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, validated.templateId))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const userList = await db
      .select()
      .from(users)
      .where(inArray(users.id, validated.userIds));

    if (userList.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid users found" },
        { status: 404 }
      );
    }

    const channels: ("wa" | "email")[] =
      validated.channel === "both" ? ["wa", "email"] : [validated.channel];

    const logEntries = await db
      .insert(notificationLogs)
      .values(
        userList.flatMap((user) =>
          channels.map((ch) => ({
            templateId: template.id,
            userId: user.id,
            channel: ch,
            priority: validated.priority,
            content: {
              text: templateEngine.render(
                template.content.text,
                validated.variables || { name: user.name, email: user.email, phone: user.phone }
              ),
            },
            status: "pending" as const,
          }))
        )
      )
      .returning();

    let queuedCount = 0;
    for (const log of logEntries) {
      const user = userList.find((u) => u.id === log.userId);
      if (!user) continue;

      await addNotificationJob({
        type: log.channel === "wa" ? "send-wa" : "send-email",
        logId: log.id,
        templateId: template.id,
        userId: user.id,
        channel: log.channel as "wa" | "email",
        priority: validated.priority,
        content: log.content || { text: "" },
        subject: template.subject || undefined,
        recipientPhone: user.phone || undefined,
        recipientEmail: user.email || undefined,
        recipientName: user.name,
      });
      queuedCount++;
    }

    return NextResponse.json(
      {
        success: true,
        data: { totalJobs: queuedCount, totalUsers: userList.length, totalChannels: channels.length },
        message: `${queuedCount} notifications queued`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to batch send notifications" },
      { status: 500 }
    );
  }
}
