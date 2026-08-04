import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSchedules } from "@/lib/db/schema";
import { updateScheduleSchema } from "@/lib/validations";
import { scheduler } from "@/lib/scheduler";
import { and, eq } from "drizzle-orm";
import type { ApiResponse, NotificationSchedule } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const scoped = isSuperadmin(session) ? undefined : eq(notificationSchedules.adminId, session.adminId);

    const [schedule] = await db
      .select()
      .from(notificationSchedules)
      .where(and(eq(notificationSchedules.id, id), scoped))
      .limit(1);

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: "Schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: schedule,
    } satisfies ApiResponse<NotificationSchedule>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const validated = updateScheduleSchema.parse(body);

    await scheduler.updateSchedule(id, validated);

    return NextResponse.json({
      success: true,
      message: "Schedule updated",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    await scheduler.deleteSchedule(id);

    return NextResponse.json({
      success: true,
      message: "Schedule deleted",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
