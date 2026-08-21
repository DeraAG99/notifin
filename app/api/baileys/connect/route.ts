import { NextResponse } from "next/server";
import { addBaileysConnectJob } from "@/lib/queue";
import {
  getSession,
  unauthorizedResponse,
} from "@/lib/auth/api";
import { getAdminStatus } from "@/lib/admin-status";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const status = await getAdminStatus(session.adminId);
    if (!status.active) {
      const reason =
        status.reason === "expired"
          ? "Akun admin sudah kedaluwarsa, hubungi superadmin untuk perpanjangan"
          : status.reason === "not_found"
            ? "Akun admin tidak ditemukan"
            : "Akun admin tidak aktif, hubungi superadmin untuk aktivasi";
      return NextResponse.json({ success: false, error: reason }, { status: 403 });
    }

    await addBaileysConnectJob(session.adminId);

    return NextResponse.json({
      success: true,
      data: { message: "Baileys connect job queued" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to queue baileys connect" },
      { status: 500 }
    );
  }
}
