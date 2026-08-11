import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importCategories } from "@/lib/db/schema";
import { createImportCategorySchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select()
      .from(importCategories)
      .where(eq(importCategories.adminId, session.adminId));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch import categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

    const body = await request.json();
    const validated = createImportCategorySchema.parse(body);

    const [existing] = await db
      .select({ id: importCategories.id })
      .from(importCategories)
      .where(
        and(
          eq(importCategories.adminId, session.adminId),
          eq(importCategories.key, validated.key)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Key "${validated.key}" sudah dipakai` },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(importCategories)
      .values({
        adminId: session.adminId,
        key: validated.key,
        name: validated.name,
        description: validated.description || null,
        isActive: validated.isActive,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: created, message: "Kategori import dibuat" },
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
      { success: false, error: "Failed to create import category" },
      { status: 500 }
    );
  }
}
