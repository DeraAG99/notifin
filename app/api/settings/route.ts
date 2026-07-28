import { NextResponse } from "next/server";
import { settingsSchema } from "@/lib/validations";
import { getFonnteClient } from "@/lib/fonnte";
import { checkEmailHealth } from "@/lib/email";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const waHealth = await getFonnteClient()
      .checkDevice()
      .then((d) => d.status)
      .catch(() => false);

    const emailHealth = await checkEmailHealth();

    return NextResponse.json({
      success: true,
      data: {
        fonnteToken: process.env.FONNTE_TOKEN ? "****" + process.env.FONNTE_TOKEN.slice(-4) : null,
        fonnteRateLimit: parseInt(process.env.FONNTE_RATE_LIMIT || "100"),
        emailFrom: process.env.EMAIL_FROM || null,
        defaultTimezone: process.env.DEFAULT_TIMEZONE || "Asia/Jakarta",
        health: {
          fonnte: waHealth,
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
    const body = await request.json();
    const validated = settingsSchema.parse(body);

    const updates: string[] = [];

    if (validated.fonnteToken) {
      process.env.FONNTE_TOKEN = validated.fonnteToken;
      updates.push("FONNTE_TOKEN");
    }
    if (validated.fonnteRateLimit) {
      process.env.FONNTE_RATE_LIMIT = String(validated.fonnteRateLimit);
      updates.push("FONNTE_RATE_LIMIT");
    }
    if (validated.emailFrom) {
      process.env.EMAIL_FROM = validated.emailFrom;
      updates.push("EMAIL_FROM");
    }
    if (validated.defaultTimezone) {
      process.env.DEFAULT_TIMEZONE = validated.defaultTimezone;
      updates.push("DEFAULT_TIMEZONE");
    }

    return NextResponse.json({
      success: true,
      message: `Updated: ${updates.join(", ") || "nothing"}`,
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
