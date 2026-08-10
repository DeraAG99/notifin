import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { updateAdminSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import type { ApiResponse, Admin } from "@/types";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
  isSuperadmin,
} from "@/lib/auth/api";
import { hashPassword } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!isSuperadmin(session)) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const validated = updateAdminSchema.parse(body);

    const [target] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 }
      );
    }

    if (target.role === "superadmin") {
      return NextResponse.json(
        { success: false, error: "Superadmin tidak dapat diubah" },
        { status: 400 }
      );
    }

    if (validated.email && validated.email !== target.email) {
      const [existing] = await db
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.email, validated.email))
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { success: false, error: "Email sudah terdaftar" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.email !== undefined) updateData.email = validated.email;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    if (validated.password) {
      updateData.passwordHash = await hashPassword(validated.password);
    }
    if (validated.expiresAt !== undefined) {
      updateData.expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : null;
    }

    const [admin] = await db
      .update(admins)
      .set(updateData)
      .where(eq(admins.id, id))
      .returning({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        role: admins.role,
        isActive: admins.isActive,
        expiresAt: admins.expiresAt,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt,
      });

    return NextResponse.json({
      success: true,
      data: admin,
      message: "Admin updated",
    } satisfies ApiResponse<Admin>);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update admin" },
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
    if (!isSuperadmin(session)) return forbiddenResponse();

    const { id } = await params;

    if (id === session.adminId) {
      return NextResponse.json(
        { success: false, error: "Tidak dapat menghapus akun sendiri" },
        { status: 400 }
      );
    }

    const [target] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 }
      );
    }

    if (target.role === "superadmin") {
      return NextResponse.json(
        { success: false, error: "Superadmin tidak dapat dihapus" },
        { status: 400 }
      );
    }

    await db.delete(admins).where(eq(admins.id, id));

    return NextResponse.json({
      success: true,
      message: "Admin deleted",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete admin" },
      { status: 500 }
    );
  }
}
