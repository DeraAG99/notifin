import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createUserSchema, bulkImportSchema } from "@/lib/validations";
import { eq, or, ilike, sql } from "drizzle-orm";
import type { ApiResponse, User, PaginatedResponse } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    const where = search
      ? or(
          ilike(users.name, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`)
        )
      : undefined;

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
    const body = await request.json();

    if (Array.isArray(body)) {
      const validated = bulkImportSchema.parse(body);

      const inserted = await db
        .insert(users)
        .values(validated)
        .returning();

      return NextResponse.json(
        {
          success: true,
          data: inserted,
          message: `${inserted.length} users imported`,
        },
        { status: 201 }
      );
    }

    const validated = createUserSchema.parse(body);
    const [user] = await db.insert(users).values(validated).returning();

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
