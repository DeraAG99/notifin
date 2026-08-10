import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importTypes } from "@/lib/db/schema";
import { updateImportTypeSchema } from "@/lib/validations";
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
    const validated = updateImportTypeSchema.parse(body);

    if (validated.key) {
      const [duplicate] = await db
        .select({ id: importTypes.id })
        .from(importTypes)
        .where(
          and(
            eq(importTypes.adminId, session.adminId),
            eq(importTypes.key, validated.key),
            eq(importTypes.isActive, true)
          )
        )
        .limit(1);
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { success: false, error: `Key "${validated.key}" sudah dipakai` },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.key !== undefined) updateData.key = validated.key;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.engine !== undefined) updateData.engine = validated.engine;
    if (validated.format !== undefined) updateData.format = validated.format;
    if (validated.detectRules !== undefined) updateData.detectRules = validated.detectRules;
    if (validated.columnMapping !== undefined) {
      updateData.columnMapping =
        (validated.columnMapping as Record<string, unknown>) || null;
    }
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    const [updated] = await db
      .update(importTypes)
      .set(updateData)
      .where(
        and(eq(importTypes.id, id), eq(importTypes.adminId, session.adminId))
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Import type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Import type diperbarui",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update import type" },
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
      .delete(importTypes)
      .where(
        and(eq(importTypes.id, id), eq(importTypes.adminId, session.adminId))
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Import type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Import type dihapus" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete import type" },
      { status: 500 }
    );
  }
}
