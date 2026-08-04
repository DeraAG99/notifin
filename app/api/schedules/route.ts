import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSchedules } from "@/lib/db/schema";
import { createScheduleSchema } from "@/lib/validations";
import { scheduler } from "@/lib/scheduler";
import { eq } from "drizzle-orm";
import type { ApiResponse, NotificationSchedule } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const scoped = isSuperadmin(session) ? undefined : eq(notificationSchedules.adminId, session.adminId);
    const schedules = scoped
      ? await db.select().from(notificationSchedules).where(scoped)
      : await db.select().from(notificationSchedules);

    return NextResponse.json({
      success: true,
      data: schedules,
    } satisfies ApiResponse<NotificationSchedule[]>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const validated = createScheduleSchema.parse(body);

    await scheduler.createSchedule({ ...validated, adminId: session.adminId });

    return NextResponse.json(
      { success: true, message: "Schedule created" },
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
      { success: false, error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
