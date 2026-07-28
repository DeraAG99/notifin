import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { createTemplateSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import type { ApiResponse, NotificationTemplate } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    const templates = channel
      ? await db
          .select()
          .from(notificationTemplates)
          .where(eq(notificationTemplates.channel, channel as "wa" | "email"))
      : await db.select().from(notificationTemplates);

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
    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    const [template] = await db
      .insert(notificationTemplates)
      .values(validated)
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
