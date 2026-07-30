import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs, notificationTemplates, users } from "@/lib/db/schema";
import { sendNotificationSchema } from "@/lib/validations";
import { addNotificationJob } from "@/lib/queue";
import { templateEngine } from "@/lib/template-engine";
import { mergeVariables } from "@/lib/variables";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = sendNotificationSchema.parse(body);

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

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, validated.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const variables = mergeVariables(user, validated.variables as Record<string, unknown> | undefined);

    const renderedText = templateEngine.render(template.content.text, variables);

    const renderedHtml = template.content.html
      ? templateEngine.render(template.content.html, variables)
      : undefined;

    const channels: ("wa" | "email")[] =
      validated.channel === "both" ? ["wa", "email"] : [validated.channel];

    const logIds: string[] = [];

    for (const ch of channels) {
      const [log] = await db
        .insert(notificationLogs)
        .values({
          templateId: template.id,
          userId: user.id,
          channel: ch,
          priority: validated.priority,
          content: { text: renderedText },
          status: "pending",
        })
        .returning();

      logIds.push(log.id);

      await addNotificationJob({
        type: ch === "wa" ? "send-wa" : "send-email",
        logId: log.id,
        templateId: template.id,
        userId: user.id,
        channel: ch,
        priority: validated.priority,
        content: { text: renderedText, html: renderedHtml },
        subject: template.subject || undefined,
        recipientPhone: user.phone || undefined,
        recipientEmail: user.email || undefined,
        recipientName: user.name,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: { logIds },
        message: `${logIds.length} notification(s) queued`,
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
      { success: false, error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
