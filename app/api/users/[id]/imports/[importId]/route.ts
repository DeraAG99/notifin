import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports, users } from "@/lib/db/schema";
import { updateImportSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
  isSuperadmin,
  type SessionPayload,
} from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";
import { slugifyKey } from "@/lib/imports/utils";

async function loadUser(session: SessionPayload, userId: string) {
  const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), scoped))
    .limit(1);
  return user;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; importId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

    const { id, importId } = await params;
    const user = await loadUser(session, id);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateImportSchema.parse(body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validated.name !== undefined) {
      updateData.name = validated.name;
      updateData.key = slugifyKey(validated.name);
    }
    if (validated.period !== undefined) updateData.period = validated.period;

    const [imported] = await db
      .update(dataImports)
      .set(updateData)
      .where(
        and(
          eq(dataImports.id, importId),
          eq(dataImports.adminId, user.adminId),
          eq(dataImports.userId, id)
        )
      )
      .returning();

    if (!imported) {
      return NextResponse.json({ success: false, error: "Import not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: imported,
      message: "Data import diperbarui",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update import" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; importId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id, importId } = await params;
    const user = await loadUser(session, id);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const [imported] = await db
      .delete(dataImports)
      .where(
        and(
          eq(dataImports.id, importId),
          eq(dataImports.adminId, user.adminId),
          eq(dataImports.userId, id)
        )
      )
      .returning();

    if (!imported) {
      return NextResponse.json({ success: false, error: "Import not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Data import dihapus" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to delete import" }, { status: 500 });
  }
}
