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
      hasEtppImport: false,
    }));

    /**
     * Which of these users have ever imported e-TPP data.
     *
     * Deliberately a plain `selectDistinct` on the id rather than a join or an
     * aggregate: this column only has to answer "has this user ever imported?",
     * so there is no date to read, no `group by`, and no Date to serialise.
     * Distinct is what collapses the per-category rows -- without it a user with
     * three import categories contributes three rows, which is harmless here but
     * would break if this ever fed a paginated query.
     *
     * No `adminId` filter on purpose. A superadmin lists users across admins
     * (`adminFilter` above is undefined for them), so scoping to
     * `session.adminId` would hide exactly those users' imports. The
     * `user_id IN (...)` list is the tenant boundary -- those ids already came
     * back from the tenant-scoped user query above.
     *
     * Fault-isolated on purpose: this is a cosmetic column bolted onto the user
     * list, and it must never be able to blank the list itself. An earlier
     * revision let this throw into the handler's catch and took the whole page
     * down with a 500, which rendered as "no users" while the data sat in the
     * database untouched.
     */
    if (includeEtpp && userList.length > 0) {
      try {
        const rows = await db
          .selectDistinct({ userId: dataImports.userId })
          .from(dataImports)
          .where(
            and(
              inArray(
                dataImports.userId,
                userList.map((user) => user.id)
              ),
              eq(dataImports.engine, ETPP_ENGINE)
            )
          );

        const imported = new Set(rows.map((row) => row.userId));
        for (const item of items) {
          if (imported.has(item.id)) item.hasEtppImport = true;
        }
      } catch (err) {
        console.error("[api/users] e-TPP import lookup failed:", err);
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
    console.error("[api/users] GET failed:", error);
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
