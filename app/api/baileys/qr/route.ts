import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select()
      .from(settings)
      .where(and(eq(settings.adminId, session.adminId), eq(settings.key, "baileys_qr")));
    const qr = rows.length > 0 ? (rows[0].value as string) : null;

    return NextResponse.json({ success: true, data: { qr } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to get Baileys QR" },
      { status: 500 }
    );
  }
}
