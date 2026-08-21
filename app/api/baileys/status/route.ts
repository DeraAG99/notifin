import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

const GRACE_PERIOD_MS = 60_000;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const scope = eq(settings.adminId, session.adminId);
    const [connectedRows, qrRows, lastSeenRows, phoneRows, errorRows] = await Promise.all([
      db.select().from(settings).where(and(scope, eq(settings.key, "baileys_connected"))),
      db.select().from(settings).where(and(scope, eq(settings.key, "baileys_qr"))),
      db.select().from(settings).where(and(scope, eq(settings.key, "baileys_last_seen"))),
      db.select().from(settings).where(and(scope, eq(settings.key, "baileys_phone"))),
      db.select().from(settings).where(and(scope, eq(settings.key, "baileys_error"))),
    ]);

    const connected = connectedRows.length > 0 && connectedRows[0].value === true;
    const lastSeen = lastSeenRows.length > 0 ? (lastSeenRows[0].value as string) : null;
    const qr = qrRows.length > 0 ? (qrRows[0].value as string) : null;
    const phone = phoneRows.length > 0 ? String(phoneRows[0].value || "") : "";
    const error = errorRows.length > 0 ? String(errorRows[0].value || "") : "";

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
        phone: phone || null,
        error: error || null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to get Baileys status" },
      { status: 500 }
    );
  }
}
