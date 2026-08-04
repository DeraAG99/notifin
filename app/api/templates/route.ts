import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { createTemplateSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import type { ApiResponse, NotificationTemplate } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");
    const scoped = isSuperadmin(session) ? undefined : eq(notificationTemplates.adminId, session.adminId);

    const templates = channel
      ? await db
          .select()
          .from(notificationTemplates)
          .where(and(eq(notificationTemplates.channel, channel as "wa" | "email"), scoped))
      : await db.select().from(notificationTemplates).where(scoped);

    return NextResponse.json({
      success: true,
      data: templates,
    } satisfies ApiResponse<NotificationTemplate[]>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const [template] = await db
      .insert(notificationTemplates)
      .values({ ...validated, adminId: session.adminId })
      .returning();

    return NextResponse.json(
      { success: true, data: template, message: "Template created" },
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
      { success: false, error: "Failed to create template" },
      { status: 500 }
    );
  }
}
