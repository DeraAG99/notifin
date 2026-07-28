import { NextResponse } from "next/server";
import { getAllQueueStats } from "@/lib/queue";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const stats = await getAllQueueStats();

    return NextResponse.json({ success: true, data: stats } satisfies ApiResponse);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch queue stats" },
      { status: 500 }
    );
  }
}
