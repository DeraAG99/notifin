import { NextResponse } from "next/server";
import { addBaileysDisconnectJob } from "@/lib/queue";
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

    await addBaileysDisconnectJob(session.adminId);

    return NextResponse.json({
      success: true,
      data: { message: "Baileys disconnect job queued" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to queue baileys disconnect" },
      { status: 500 }
    );
  }
}
