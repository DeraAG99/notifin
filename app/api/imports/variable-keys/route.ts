import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importCategories, dataImports } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({
        id: importCategories.id,
        key: importCategories.key,
        name: importCategories.name,
      })
      .from(importCategories)
      .where(
        and(
          eq(importCategories.adminId, session.adminId),
          eq(importCategories.isActive, true)
        )
      )
      .orderBy(importCategories.createdAt);

    const imports = await db
      .select({
        categoryId: dataImports.categoryId,
        data: dataImports.data,
      })
      .from(dataImports)
      .where(eq(dataImports.adminId, session.adminId));

    const fieldsByCategory = new Map<string, string[]>();
    for (const imp of imports) {
      if (fieldsByCategory.has(imp.categoryId)) continue;
      const items = Array.isArray(imp.data) ? imp.data : [];
      const first = items.find(
        (item) => item && typeof item === "object" && "raw" in item && item.raw
      ) as { raw?: Record<string, unknown> } | undefined;
      if (first?.raw) {
        fieldsByCategory.set(imp.categoryId, Object.keys(first.raw));
      }
    }

    const data = rows.map((r) => ({
      key: r.key,
      name: r.name,
      rowFields: fieldsByCategory.get(r.id) || [],
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch import variable keys" },
      { status: 500 }
    );
  }
}
