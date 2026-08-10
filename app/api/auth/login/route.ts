import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { type SessionPayload, verifyPassword, createToken, getCookieName, getCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, validated.email))
      .limit(1);

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi salah" },
        { status: 401 }
      );
    }

    if (admin.expiresAt && new Date(admin.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Akun telah kedaluwarsa. Hubungi super admin." },
        { status: 401 }
      );
    }

    const match = await verifyPassword(validated.password, admin.passwordHash);
    if (!match) {
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi salah" },
        { status: 401 }
      );
    }

    const payload: SessionPayload = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role || "admin",
    };

    const token = await createToken(payload);
    const cookieName = getCookieName();
    const response = NextResponse.json({ success: true, data: payload });
    response.cookies.set(cookieName, token, getCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
