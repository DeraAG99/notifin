import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const GRACE_PERIOD_MS = 60_000;

export async function GET() {
  try {
    const [connectedRows, qrRows, lastSeenRows] = await Promise.all([
      db.select().from(settings).where(eq(settings.key, "baileys_connected")),
      db.select().from(settings).where(eq(settings.key, "baileys_qr")),
      db.select().from(settings).where(eq(settings.key, "baileys_last_seen")),
    ]);

    const connected = connectedRows.length > 0 && connectedRows[0].value === true;
    const lastSeen = lastSeenRows.length > 0 ? (lastSeenRows[0].value as string) : null;
    const qr = qrRows.length > 0 ? (qrRows[0].value as string) : null;

    let effectiveStatus = connected;
    let reconnecting = false;

    if (!connected && lastSeen) {
      const elapsed = Date.now() - new Date(lastSeen).getTime();
      if (elapsed < GRACE_PERIOD_MS) {
        effectiveStatus = true;
        reconnecting = true;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: effectiveStatus,
        reconnecting,
        qr,
        lastSeen,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to get Baileys status" },
      { status: 500 }
    );
  }
}
