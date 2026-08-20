import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs, notificationTemplates, users, dataImports, importCategories } from "@/lib/db/schema";
import { batchSendSchema } from "@/lib/validations";
import { addNotificationJob } from "@/lib/queue";
import { templateEngine } from "@/lib/template-engine";
import { resolveImportVars } from "@/lib/imports/variables";
import { extractImportKeys } from "@/lib/imports/utils";
import { and, eq, inArray } from "drizzle-orm";
import type { ApiResponse } from "@/types";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

    const body = await request.json();
    const validated = batchSendSchema.parse(body);

    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.id, validated.templateId), eq(notificationTemplates.adminId, session.adminId)))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    let userList = await db
      .select()
      .from(users)
      .where(and(inArray(users.id, validated.userIds), eq(users.adminId, session.adminId)));

    const importKeys = extractImportKeys(template.content.text);
    let skippedCount = 0;

    if (importKeys.length > 0) {
      const keyRows = await db
        .select({ userId: dataImports.userId, categoryKey: importCategories.key, scope: dataImports.scope })
        .from(dataImports)
        .innerJoin(importCategories, eq(dataImports.categoryId, importCategories.id))
        .where(
          and(
            eq(dataImports.adminId, session.adminId),
            inArray(importCategories.key, importKeys)
          )
        );

      const globalKeys = new Set<string>();
      const keysByUser = new Map<string, Set<string>>();
      for (const row of keyRows) {
        if (!row.categoryKey) continue;
        if (row.scope === "global") {
          globalKeys.add(row.categoryKey);
          continue;
        }
        if (!row.userId) continue;
        const set = keysByUser.get(row.userId) || new Set<string>();
        set.add(row.categoryKey);
        keysByUser.set(row.userId, set);
      }

      const uncoveredKeys = importKeys.filter((k) => !globalKeys.has(k));

      if (uncoveredKeys.length > 0) {
        const kept = userList.filter((u) =>
          uncoveredKeys.every((k) => keysByUser.get(u.id)?.has(k))
        );
        skippedCount = userList.length - kept.length;
        userList = kept;
      }
    }

    if (userList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid users found",
          message: `Tidak ada user yang memiliki data import yang dibutuhkan template (${importKeys.join(", ") || "n/a"})`,
        },
        { status: 404 }
      );
    }

    const channels: ("wa" | "email")[] =
      validated.channel === "both" ? ["wa", "email"] : [validated.channel];

    const entries: {
      adminId: string;
      templateId: string;
      userId: string;
      channel: "wa" | "email";
      priority: "urgent" | "normal" | "low";
      content: { text: string; html?: string };
      status: "pending";
    }[] = [];

    for (const user of userList) {
      const vars = await resolveImportVars(
        user,
        validated.variables as Record<string, unknown> | undefined
      );
      const renderedText = templateEngine.render(template.content.text, vars);
      const renderedHtml = template.content.html
        ? templateEngine.render(template.content.html, vars)
        : undefined;
      for (const ch of channels) {
        entries.push({
          adminId: session.adminId,
          templateId: template.id,
          userId: user.id,
          channel: ch,
          priority: validated.priority,
          content: { text: renderedText, html: renderedHtml },
          status: "pending",
        });
      }
    }

    const logEntries = await db
      .insert(notificationLogs)
      .values(entries)
      .returning();

    let queuedCount = 0;
    for (const log of logEntries) {
      const user = userList.find((u) => u.id === log.userId);
      if (!user) continue;

      await addNotificationJob({
        type: log.channel === "wa" ? "send-wa" : "send-email",
        adminId: session.adminId,
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
        data: {
          totalJobs: queuedCount,
          totalUsers: userList.length,
          totalChannels: channels.length,
          skippedCount,
        },
        message:
          skippedCount > 0
            ? `${queuedCount} notifications queued, ${skippedCount} user(s) skipped (no matching import data)`
            : `${queuedCount} notifications queued`,
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
