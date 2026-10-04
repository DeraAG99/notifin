import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports, users } from "@/lib/db/schema";
import { createUserSchema } from "@/lib/validations";
import { bulkUpsertUsers } from "@/lib/users/bulk-import";
import { and, eq, or, ilike, inArray, sql } from "drizzle-orm";
import type { ApiResponse, User, PaginatedResponse, UserWithEtpp } from "@/types";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";
import { isSuperadmin } from "@/lib/auth/api";
import { ETPP_ENGINE } from "@/lib/imports/variables";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;
    const includeEtpp = searchParams.get("includeEtpp") === "1";

    const adminFilter = isSuperadmin(session) ? undefined : eq(users.adminId, session.adminId);

    const where = search
      ? and(
          adminFilter,
          or(
            ilike(users.name, `%${search}%`),
            ilike(users.phone, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(users.jabatan, `%${search}%`),
            ilike(users.unitKerja, `%${search}%`)
          )
        )
      : adminFilter;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where);

    const userList = await db
      .select()
      .from(users)
      .where(where)
      .limit(pageSize)
      .offset(offset);

    const items: UserWithEtpp[] = (userList as User[]).map((user) => ({
      ...user,
      etppLastImportAt: null,
    }));

    /**
     * Whether each user has ever imported e-TPP data, plus when.
     *
     * A separate aggregate query, never a join: `data_imports` is unique per
     * (admin_id, user_id, category_id), so one user can hold a row per import
     * category. Joining it into the user select would multiply rows and quietly
     * break both the limit/offset and the total in the pagination header.
     *
     * There is deliberately no `adminId` filter. A superadmin lists users across
     * admins (`adminFilter` above is undefined for them), so scoping to
     * `session.adminId` would hide exactly those users' imports. The
     * `user_id IN (...)` list is the tenant boundary -- those ids already came
     * back from the tenant-scoped user query above.
     *
     * Grouping is required: `user_id` alone would return one row per category,
     * and `lastImportAt` would then be whichever category Postgres emitted
     * last, not the most recent import.
     */
    if (includeEtpp && userList.length > 0) {
      const rows = await db
        .select({
          userId: dataImports.userId,
          lastImportAt: sql<Date | null>`max(${dataImports.updatedAt})`,
        })
        .from(dataImports)
        .where(
          and(
            inArray(
              dataImports.userId,
              userList.map((user) => user.id)
            ),
            eq(dataImports.engine, ETPP_ENGINE)
          )
        )
        .groupBy(dataImports.userId);

      const lastImportByUser = new Map(
        rows.map((row) => [row.userId, row.lastImportAt])
      );
      for (const item of items) {
        const lastImportAt = lastImportByUser.get(item.id);
        if (lastImportAt) item.etppLastImportAt = lastImportAt.toISOString();
      }
    }

    const response: PaginatedResponse<UserWithEtpp> = {
      items,
      total: Number(countResult.count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(countResult.count) / pageSize),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();

    if (Array.isArray(body)) {
      const result = await bulkUpsertUsers(body, session.adminId);

      const summary =
        `${result.created} user baru, ${result.updated} diperbarui` +
        (result.errors.length > 0 ? `, ${result.errors.length} baris gagal` : "");

      return NextResponse.json(
        {
          success: result.errors.length === 0,
          data: result.data,
          created: result.created,
          updated: result.updated,
          errors: result.errors,
          warnings: result.warnings,
          message: summary,
        },
        // Partial success is a normal outcome, not a server fault: report it as
        // 200 with a per-row breakdown so the UI can show what happened. A 500
        // would tell the user nothing about which rows were the problem.
        { status: 200 }
      );
    }

    const validated = createUserSchema.parse(body);
    const [user] = await db
      .insert(users)
      .values({ ...validated, adminId: session.adminId })
      .returning();

    return NextResponse.json(
      { success: true, data: user, message: "User created" },
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
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
