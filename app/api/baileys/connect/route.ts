import { NextResponse } from "next/server";
import { addBaileysConnectJob } from "@/lib/queue";

export async function POST() {
  try {
    await addBaileysConnectJob();

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
