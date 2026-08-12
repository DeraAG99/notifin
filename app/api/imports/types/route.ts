import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importTypes } from "@/lib/db/schema";
import { createImportTypeSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select()
      .from(importTypes)
      .where(eq(importTypes.adminId, session.adminId));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch import types" },
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
    const validated = createImportTypeSchema.parse(body);

    const [existing] = await db
      .select({ id: importTypes.id })
      .from(importTypes)
      .where(
        and(
          eq(importTypes.adminId, session.adminId),
          eq(importTypes.key, validated.key)
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
      .insert(importTypes)
      .values({
        adminId: session.adminId,
        key: validated.key,
        name: validated.name,
        engine: validated.engine,
        format: validated.format,
        detectRules: validated.detectRules,
        columnMapping:
          (validated.columnMapping as Record<string, unknown>) || null,
        isActive: validated.isActive,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: created, message: "Import type dibuat" },
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
      { success: false, error: "Failed to create import type" },
      { status: 500 }
    );
  }
}
