import { NextResponse } from "next/server";
import { getAllQueueStats } from "@/lib/queue";

const FALLBACK_STATS = {
  whatsapp: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
  email: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
  scheduled: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
  baileys: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
};

export async function GET() {
  try {
    const stats = await Promise.race([
      getAllQueueStats(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), 3000)
      ),
    ]);

    return NextResponse.json({ success: true, data: stats ?? FALLBACK_STATS });
  } catch {
    return NextResponse.json({ success: true, data: FALLBACK_STATS });
  }
}
