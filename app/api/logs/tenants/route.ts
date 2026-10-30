import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse, forbiddenResponse, isSuperadmin } from "@/lib/auth/api";
import { listLogTenants } from "@/lib/db/logs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    if (!isSuperadmin(session)) return forbiddenResponse();
    return NextResponse.json({ success: true, data: await listLogTenants() });
  } catch (error) {
    console.error("Failed to fetch log tenants:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat tenant" }, { status: 500 });
  }
}
