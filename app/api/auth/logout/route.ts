import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/auth/session";

export async function POST() {
  try {
    const cookieName = getCookieName();
    const response = NextResponse.json({ success: true });
    response.cookies.delete(cookieName);
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
