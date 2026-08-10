import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports, importTypes, users } from "@/lib/db/schema";
import { createImportSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
  isSuperadmin,
  type SessionPayload,
} from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";
import type { ImportItem } from "@/lib/imports/types";
import { buildSummary, slugifyKey } from "@/lib/imports/utils";

async function loadUser(session: SessionPayload, userId: string) {
  const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), scoped))
    .limit(1);
  return user;
}

async function uniqueKey(adminId: string, userId: string, base: string): Promise<string> {
  const existing = await db
    .select({ key: dataImports.key })
    .from(dataImports)
    .where(and(eq(dataImports.adminId, adminId), eq(dataImports.userId, userId)));
  const keys = new Set(existing.map((r) => r.key));
  let candidate = base;
  let i = 2;
  while (keys.has(candidate)) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  return candidate;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const user = await loadUser(session, id);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const rows = await db
      .select({
        id: dataImports.id,
        adminId: dataImports.adminId,
        userId: dataImports.userId,
        name: dataImports.name,
        source: dataImports.source,
        engine: dataImports.engine,
        key: dataImports.key,
        fileName: dataImports.fileName,
        period: dataImports.period,
        data: dataImports.data,
        summary: dataImports.summary,
        createdAt: dataImports.createdAt,
        updatedAt: dataImports.updatedAt,
      })
      .from(dataImports)
      .where(and(eq(dataImports.adminId, user.adminId), eq(dataImports.userId, id)))
      .orderBy(desc(dataImports.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch imports" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

    const { id } = await params;
    const user = await loadUser(session, id);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = createImportSchema.parse(body);

    const [type] = await db
      .select()
      .from(importTypes)
      .where(
        and(
          eq(importTypes.id, validated.importTypeId),
          eq(importTypes.adminId, session.adminId)
        )
      )
      .limit(1);

    if (!type || !type.isActive) {
      return NextResponse.json(
        { success: false, error: "Tipe import tidak ditemukan atau nonaktif" },
        { status: 400 }
      );
    }

    const items = validated.items as ImportItem[];
    const key = await uniqueKey(session.adminId, id, slugifyKey(validated.name));

    const [imported] = await db
      .insert(dataImports)
      .values({
        adminId: session.adminId,
        userId: id,
        name: validated.name,
        source: type.key,
        engine: type.engine,
        key,
        fileName: validated.fileName,
        period: validated.period || null,
        data: items as unknown as Record<string, unknown>[],
        summary: buildSummary(items),
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: imported,
        message: `Data "${validated.name}" berhasil diimpor (${items.length} item)`,
      },
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
      { success: false, error: "Failed to import data" },
      { status: 500 }
    );
  }
}
