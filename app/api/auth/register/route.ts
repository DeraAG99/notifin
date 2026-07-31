import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import {
  type SessionPayload,
  hashPassword,
  createToken,
  getCookieName,
  getCookieOptions,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

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
        email: validated.email,
        passwordHash,
        name: validated.name,
        role: "admin",
      })
      .returning();

    const payload: SessionPayload = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role || "admin",
    };

    const token = await createToken(payload);
    const cookieName = getCookieName();
    const response = NextResponse.json({
      success: true,
      data: payload,
      message: "Akun berhasil dibuat",
    });
    response.cookies.set(cookieName, token, getCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Data tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
