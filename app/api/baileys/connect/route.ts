import { NextResponse } from "next/server";
import { addBaileysConnectJob } from "@/lib/queue";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

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
