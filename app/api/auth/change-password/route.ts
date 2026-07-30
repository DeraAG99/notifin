import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { admins } from "@/lib/db/schema";
import { changePasswordSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = changePasswordSchema.parse(body);

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, session.adminId))
      .limit(1);

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Admin tidak ditemukan" },
        { status: 404 }
      );
    }

    const match = await verifyPassword(validated.currentPassword, admin.passwordHash);
    if (!match) {
      return NextResponse.json(
        { success: false, error: "Password saat ini salah" },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(validated.newPassword);
    await db
      .update(admins)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(admins.id, session.adminId));

    return NextResponse.json({ success: true, message: "Password berhasil diubah" });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Password baru minimal 6 karakter" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
