import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports, importTypes, importCategories } from "@/lib/db/schema";
import { createImportSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";
import type { ImportItem } from "@/lib/imports/types";
import { buildSummary } from "@/lib/imports/utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({
        id: dataImports.id,
        adminId: dataImports.adminId,
        categoryId: dataImports.categoryId,
        categoryName: importCategories.name,
        categoryKey: importCategories.key,
        source: dataImports.source,
        engine: dataImports.engine,
        fileName: dataImports.fileName,
        period: dataImports.period,
        data: dataImports.data,
        summary: dataImports.summary,
        createdAt: dataImports.createdAt,
        updatedAt: dataImports.updatedAt,
      })
      .from(dataImports)
      .innerJoin(importCategories, eq(dataImports.categoryId, importCategories.id))
      .where(
        and(
          eq(dataImports.adminId, session.adminId),
          eq(dataImports.scope, "global")
        )
      )
      .orderBy(desc(dataImports.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch global imports" },
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

    const [category] = await db
      .select()
      .from(importCategories)
      .where(
        and(
          eq(importCategories.id, validated.categoryId),
          eq(importCategories.adminId, session.adminId)
        )
      )
      .limit(1);

    if (!category || !category.isActive) {
      return NextResponse.json(
        { success: false, error: "Kategori import tidak ditemukan atau nonaktif" },
        { status: 400 }
      );
    }

    const items = validated.items as ImportItem[];

    const [imported] = await db.transaction(async (tx) => {
      await tx
        .delete(dataImports)
        .where(
          and(
            eq(dataImports.adminId, session.adminId),
            eq(dataImports.categoryId, category.id),
            eq(dataImports.scope, "global")
          )
        );

      return tx
        .insert(dataImports)
        .values({
          adminId: session.adminId,
          scope: "global",
          categoryId: category.id,
          source: type.key,
          engine: type.engine,
          fileName: validated.fileName,
          period: validated.period || null,
          data: items as unknown as Record<string, unknown>[],
          summary: buildSummary(items),
        })
        .returning();
    });

    return NextResponse.json(
      {
        success: true,
        data: imported,
        message: `Data global "${category.name}" berhasil diimpor (${items.length} item)`,
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
      { success: false, error: "Failed to import global data" },
      { status: 500 }
    );
  }
}
