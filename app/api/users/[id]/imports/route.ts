import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports, importTypes, importCategories, users } from "@/lib/db/schema";
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
import { buildSummary } from "@/lib/imports/utils";
import { extractEtppVariables } from "@/lib/users/etpp-extract";

async function loadUser(session: SessionPayload, userId: string) {
  const scoped = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), scoped))
    .limit(1);
  return user;
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

    /**
     * Jabatan / unit kerja auto-fill.
     *
     * Only the e-TPP engine ("ekinerja-json") carries a profile block, and only
     * this per-user route has a single user to write to -- the global import
     * route has no target user, so it deliberately does nothing here.
     *
     * Default is fill-if-empty: a value already on the user record (set
     * manually, or from a previous import) is never clobbered. The client can
     * pass `overwriteProfile: true` to force it.
     */
    const profile =
      type.engine === "ekinerja-json" ? validated.profile : undefined;
    const overwrite = validated.overwriteProfile === true;
    const profileApplied = { jabatan: false, unitKerja: false };
    let profileAppliedData: { jabatan?: string; unitKerja?: string } | undefined;
    let etppSkippedNoKode = 0;

    let profilePayload: { jabatan?: string; unitKerja?: string } | undefined;
    if (profile) {
      profilePayload = {};
      if (profile.jabatan && (overwrite || !user.jabatan)) {
        profilePayload.jabatan = profile.jabatan;
        profileApplied.jabatan = true;
      }
      if (profile.unitKerja && (overwrite || !user.unitKerja)) {
        profilePayload.unitKerja = profile.unitKerja;
        profileApplied.unitKerja = true;
      }
    }

    const [imported] = await db.transaction(async (tx) => {
      await tx
        .delete(dataImports)
        .where(
          and(
            eq(dataImports.adminId, session.adminId),
            eq(dataImports.userId, id),
            eq(dataImports.categoryId, category.id)
          )
        );

      const userPatch: { jabatan?: string; unitKerja?: string } = {};

      if (profilePayload?.jabatan || profilePayload?.unitKerja) {
        if (profilePayload.jabatan) userPatch.jabatan = profilePayload.jabatan;
        if (profilePayload.unitKerja) userPatch.unitKerja = profilePayload.unitKerja;
        profileAppliedData = { jabatan: profilePayload.jabatan, unitKerja: profilePayload.unitKerja };
      }

      // No snapshot is written onto `users.metadata`. The e-TPP notification
      // variables are rebuilt from `data_imports.data` at send time, so this
      // stays the single source of truth and already-imported files keep
      // working untouched. Still counted so the admin hears about unusable rows.
      if (type.engine === "ekinerja-json" && items.length > 0) {
        etppSkippedNoKode = extractEtppVariables(items).skippedNoKode;
      }

      if (Object.keys(userPatch).length > 0) {
        await tx
          .update(users)
          .set({ ...userPatch, updatedAt: new Date() })
          .where(and(eq(users.id, id), eq(users.adminId, session.adminId)));
      }

      return tx
        .insert(dataImports)
        .values({
          adminId: session.adminId,
          userId: id,
          categoryId: category.id,
          source: type.key,
          engine: type.engine,
          fileName: validated.fileName,
          period: validated.period || null,
          data: items as unknown as Record<string, unknown>[],
          summary: buildSummary(items, etppSkippedNoKode),
        })
        .returning();
    });

    const profileNotice =
      profileApplied.jabatan || profileApplied.unitKerja
        ? " Jabatan/unit kerja terisi otomatis dari file."
        : "";

    // Logged server-side for the audit trail and echoed in the response so the
    // admin sees the drop instead of a quietly short notification. A row with
    // no `kode_sumber` cannot be placed in IKU or Lainnya, and guessing would
    // mislabel the whole message.
    const etppSkipNotice =
      etppSkippedNoKode > 0
        ? ` ${etppSkippedNoKode} baris tanpa kode_sumber dilewati (tidak bisa ditentukan IKU atau Lainnya).`
        : "";

    if (etppSkippedNoKode > 0) {
      console.log(
        `[etpp] ${etppSkippedNoKode} baris tanpa kode_sumber dilewati`,
        {
          adminId: session.adminId,
          userId: id,
          fileName: validated.fileName,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: imported,
        profileApplied,
        message: `Data "${category.name}" berhasil diimpor (${items.length} item).${profileNotice}${etppSkipNotice}`,
        profile: profileAppliedData || null,
        etppSkippedNoKode,
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
