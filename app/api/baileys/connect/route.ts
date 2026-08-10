import { NextResponse } from "next/server";
import { addBaileysConnectJob } from "@/lib/queue";
import {
  getSession,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/api";
import { isAdminActive } from "@/lib/admin-status";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    if (!(await isAdminActive(session.adminId))) return forbiddenResponse();

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
