import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createUserSchema } from "@/lib/validations";
import { bulkUpsertUsers } from "@/lib/users/bulk-import";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import type { ApiResponse, User, PaginatedResponse } from "@/types";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";
import { isSuperadmin } from "@/lib/auth/api";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

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

    const response: PaginatedResponse<User> = {
      items: userList as User[],
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
