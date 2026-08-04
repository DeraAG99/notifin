import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs } from "@/lib/db/schema";
import { logFilterSchema } from "@/lib/validations";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import type { ApiResponse, NotificationLog, PaginatedResponse } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);

    const filters = logFilterSchema.parse({
      channel: searchParams.get("channel") || undefined,
      status: searchParams.get("status") || undefined,
      userId: searchParams.get("userId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "20",
    });

    const scoped = isSuperadmin(session) ? undefined : eq(notificationLogs.adminId, session.adminId);
    const conditions = [scoped].filter(Boolean);

    if (filters.channel) conditions.push(eq(notificationLogs.channel, filters.channel));
    if (filters.status) conditions.push(eq(notificationLogs.status, filters.status));
    if (filters.userId) conditions.push(eq(notificationLogs.userId, filters.userId));
    if (filters.startDate) conditions.push(gte(notificationLogs.createdAt, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(notificationLogs.createdAt, new Date(filters.endDate)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.pageSize;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationLogs)
      .where(where);

    const logs = await db
      .select()
      .from(notificationLogs)
      .where(where)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(filters.pageSize)
      .offset(offset);

    const response: PaginatedResponse<NotificationLog> = {
      items: logs as NotificationLog[],
      total: Number(countResult.count),
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(Number(countResult.count) / filters.pageSize),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
