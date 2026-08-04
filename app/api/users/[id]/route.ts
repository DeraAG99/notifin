import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { updateUserSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import type { ApiResponse, User } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), scoped))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    } satisfies ApiResponse<User>);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const validated = updateUserSchema.parse(body);
    const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);

    const [user] = await db
      .update(users)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(eq(users.id, id), scoped))
      .returning();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: "User updated",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
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
    const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);

    const [user] = await db
      .delete(users)
      .where(and(eq(users.id, id), scoped))
      .returning();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User deleted",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
