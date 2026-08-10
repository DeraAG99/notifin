import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { createAdminSchema } from "@/lib/validations";
import { eq, ilike, or, sql } from "drizzle-orm";
import type { ApiResponse, AdminSummary, PaginatedResponse } from "@/types";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
  isSuperadmin,
} from "@/lib/auth/api";
import { hashPassword } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!isSuperadmin(session)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    const where = search
      ? or(
          ilike(admins.name, `%${search}%`),
          ilike(admins.email, `%${search}%`)
        )
      : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(admins)
      .where(where);

    const adminList = await db
      .select({
        id: admins.id,
        email: admins.email,
        name: admins.name,
        role: admins.role,
        isActive: admins.isActive,
        expiresAt: admins.expiresAt,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt,
        userCount: sql<number>`COALESCE((SELECT count(*) FROM users WHERE users.admin_id = admins.id), 0)`,
      })
      .from(admins)
      .where(where)
      .limit(pageSize)
      .offset(offset);

    const response: PaginatedResponse<AdminSummary> = {
      items: adminList as AdminSummary[],
      total: Number(countResult.count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(countResult.count) / pageSize),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!isSuperadmin(session)) return forbiddenResponse();

    const body = await request.json();
    const validated = createAdminSchema.parse(body);

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

    const passwordHash = await hashPassword(validated.password);
    const [admin] = await db
      .insert(admins)
      .values({
        name: validated.name,
        email: validated.email,
        passwordHash,
        role: "admin",
        isActive: validated.isActive,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
      })
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

    return NextResponse.json(
      {
        success: true,
        data: admin,
        message: "Admin created",
      } satisfies ApiResponse,
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
      { success: false, error: "Failed to create admin" },
      { status: 500 }
    );
  }
}
