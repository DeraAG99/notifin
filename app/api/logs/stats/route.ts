import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationLogs } from "@/lib/db/schema";
import { sql, eq, gte, and } from "drizzle-orm";
import type { ApiResponse, DashboardStats } from "@/types";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalStats] = await db
      .select({
        totalSent: sql<number>`count(*) filter (where ${notificationLogs.status} = 'sent')`,
        totalDelivered: sql<number>`count(*) filter (where ${notificationLogs.status} = 'delivered')`,
        totalFailed: sql<number>`count(*) filter (where ${notificationLogs.status} = 'failed')`,
        totalPending: sql<number>`count(*) filter (where ${notificationLogs.status} = 'pending')`,
      })
      .from(notificationLogs);

    const [todayStats] = await db
      .select({
        sentToday: sql<number>`count(*)`,
      })
      .from(notificationLogs)
      .where(gte(notificationLogs.createdAt, today));

    const dailyStats = await db
      .select({
        date: sql<string>`to_char(${notificationLogs.createdAt}, 'YYYY-MM-DD')`,
        wa: sql<number>`count(*) filter (where ${notificationLogs.channel} = 'wa')`,
        email: sql<number>`count(*) filter (where ${notificationLogs.channel} = 'email')`,
      })
      .from(notificationLogs)
      .where(gte(notificationLogs.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${notificationLogs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${notificationLogs.createdAt}, 'YYYY-MM-DD')`);

    const stats: DashboardStats = {
      totalSent: Number(totalStats.totalSent),
      totalDelivered: Number(totalStats.totalDelivered),
      totalFailed: Number(totalStats.totalFailed),
      totalPending: Number(totalStats.totalPending),
      sentToday: Number(todayStats.sentToday),
      charts: dailyStats.map((row) => ({
        date: row.date,
        wa: Number(row.wa),
        email: Number(row.email),
      })),
    };

    return NextResponse.json({ success: true, data: stats } satisfies ApiResponse<DashboardStats>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
