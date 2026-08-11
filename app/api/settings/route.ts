import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { settingsSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { getWaHealth, resetWaProvider } from "@/lib/wa";
import { checkEmailHealth, resetEmailTransporter } from "@/lib/email";
import { addBaileysDisconnectJob } from "@/lib/queue";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

const SETTING_KEYS = [
  "waProvider",
  "fonnteToken",
  "fonnteRateLimit",
  "evolutionBaseUrl",
  "evolutionApiKey",
  "evolutionInstance",
  "openwaBaseUrl",
  "openwaApiKey",
  "openwaSession",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPass",
  "smtpSecure",
  "emailProvider",
  "emailFrom",
  "emailFromName",
  "defaultTimezone",
  "waConcurrency",
  "emailConcurrency",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

const STRING_SETTINGS: SettingKey[] = [
  "waProvider",
  "fonnteToken",
  "evolutionBaseUrl",
  "evolutionApiKey",
  "evolutionInstance",
  "openwaBaseUrl",
  "openwaApiKey",
  "openwaSession",
  "smtpHost",
  "smtpUser",
  "smtpPass",
  "smtpSecure",
  "emailProvider",
  "emailFrom",
  "emailFromName",
  "defaultTimezone",
];

const NUMBER_SETTINGS: SettingKey[] = [
  "fonnteRateLimit",
  "smtpPort",
  "waConcurrency",
  "emailConcurrency",
];

async function getSettingsMap(adminId: string): Promise<Record<string, string | number | boolean | null>> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.adminId, adminId));
  const map: Record<string, string | number | boolean | null> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

function mask(value: string | number | boolean | null): string | null {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 4) return "****";
  return "****" + s.slice(-4);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const [waHealth, emailHealth, stored] = await Promise.all([
      getWaHealth(session.adminId),
      checkEmailHealth(session.adminId),
      getSettingsMap(session.adminId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        waProvider: stored.waProvider || "fonnte",
        fonnteToken: mask(stored.fonnteToken),
        fonnteRateLimit: Number(stored.fonnteRateLimit) || 100,
        openwaBaseUrl: stored.openwaBaseUrl || null,
        openwaApiKey: mask(stored.openwaApiKey),
        openwaSession: stored.openwaSession || null,
        smtpHost: stored.smtpHost || null,
        smtpPort: Number(stored.smtpPort) || 587,
        smtpUser: stored.smtpUser || null,
        smtpPass: stored.smtpPass ? "****" : null,
        smtpSecure: (stored.smtpSecure as string) || null,
        emailProvider: stored.emailProvider || "smtp",
        emailFrom: stored.emailFrom || null,
        emailFromName: stored.emailFromName || null,
        defaultTimezone: stored.defaultTimezone || "Asia/Jakarta",
        serverTime: new Date().toISOString(),
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        health: {
          wa: waHealth,
          email: emailHealth,
          redis: true,
          database: true,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const validated = settingsSchema.parse(body);

    const [currentProviderRow] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.adminId, session.adminId), eq(settings.key, "waProvider")))
      .limit(1);
    const oldWaProvider = (currentProviderRow?.value as string) || "fonnte";

    const entries: { key: SettingKey; value: string | number }[] = [];

    for (const key of STRING_SETTINGS) {
      const val = validated[key as keyof typeof validated];
      if (val !== undefined) entries.push({ key, value: val });
    }

    for (const key of NUMBER_SETTINGS) {
      const val = validated[key as keyof typeof validated];
      if (val !== undefined) entries.push({ key, value: val });
    }

    for (const entry of entries) {
      await db
        .insert(settings)
        .values({ adminId: session.adminId, key: entry.key, value: entry.value })
        .onConflictDoUpdate({
          target: [settings.adminId, settings.key],
          set: { value: entry.value, updatedAt: new Date() },
        });
    }

    const hasWaUpdate = entries.some(
      (e) =>
        e.key === "waProvider" ||
        e.key === "fonnteToken" ||
        e.key === "fonnteRateLimit" ||
        e.key === "evolutionBaseUrl" ||
        e.key === "evolutionApiKey" ||
        e.key === "evolutionInstance" ||
        e.key === "openwaBaseUrl" ||
        e.key === "openwaApiKey" ||
        e.key === "openwaSession"
    );
    if (hasWaUpdate) resetWaProvider(session.adminId);

    if (
      validated.waProvider !== undefined &&
      oldWaProvider === "baileys" &&
      validated.waProvider !== "baileys"
    ) {
      await addBaileysDisconnectJob(session.adminId);
    }

    const hasSmtpUpdate = entries.some(
      (e) =>
        e.key === "smtpHost" ||
        e.key === "smtpPort" ||
        e.key === "smtpUser" ||
        e.key === "smtpPass" ||
        e.key === "smtpSecure" ||
        e.key === "emailFrom"
    );
    if (hasSmtpUpdate) resetEmailTransporter(session.adminId);

    const updatedKeys = entries.map((e) => e.key);

    return NextResponse.json({
      success: true,
      message: `Updated: ${updatedKeys.join(", ") || "nothing"}`,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
