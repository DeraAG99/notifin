import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importCategories } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({ key: importCategories.key, name: importCategories.name })
      .from(importCategories)
      .where(
        and(
          eq(importCategories.adminId, session.adminId),
          eq(importCategories.isActive, true)
        )
      )
      .orderBy(importCategories.createdAt);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch import variable keys" },
      { status: 500 }
    );
  }
}
