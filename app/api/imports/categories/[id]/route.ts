import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importCategories } from "@/lib/db/schema";
import { updateImportCategorySchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const validated = updateImportCategorySchema.parse(body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    const [updated] = await db
      .update(importCategories)
      .set(updateData)
      .where(
        and(
          eq(importCategories.id, id),
          eq(importCategories.adminId, session.adminId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Kategori import tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Kategori import diperbarui",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update import category" },
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

    const [deleted] = await db
      .delete(importCategories)
      .where(
        and(
          eq(importCategories.id, id),
          eq(importCategories.adminId, session.adminId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Kategori import tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Kategori import dihapus" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete import category" },
      { status: 500 }
    );
  }
}
