import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { updateTemplateSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import type { ApiResponse, NotificationTemplate } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    } satisfies ApiResponse<NotificationTemplate>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    const [template] = await db
      .update(notificationTemplates)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(notificationTemplates.id, id))
      .returning();

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
      message: "Template updated",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [template] = await db
      .delete(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .returning();

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Template deleted",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
