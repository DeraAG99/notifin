import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationTemplates, settings } from "@/lib/db/schema";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";
import { ETPP_TEMPLATE_SETTING_KEY } from "@/workers/etpp-notification";

const bodySchema = z.object({
  templateId: z.string().uuid().nullable(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(
        and(
          eq(settings.adminId, session.adminId),
          eq(settings.key, ETPP_TEMPLATE_SETTING_KEY)
        )
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { templateId: (row?.value as string) ?? null },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch e-TPP template setting" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const body = bodySchema.parse(await request.json());

    if (body.templateId) {
      // Reject templates owned by another tenant outright rather than storing a
      // reference the scheduler would later render for the wrong admin.
      const [template] = await db
        .select({ id: notificationTemplates.id })
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.id, body.templateId),
            eq(notificationTemplates.adminId, session.adminId)
          )
        )
        .limit(1);

      if (!template) {
        return NextResponse.json(
          { success: false, error: "Template tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    await db
      .insert(settings)
      .values({
        adminId: session.adminId,
        key: ETPP_TEMPLATE_SETTING_KEY,
        value: body.templateId ?? null,
      })
      .onConflictDoUpdate({
        target: [settings.adminId, settings.key],
        set: { value: body.templateId ?? null, updatedAt: new Date() },
      });

    return NextResponse.json({
      success: true,
      data: { templateId: body.templateId },
      message: body.templateId
        ? "Template e-TPP aktif. Notifikasi akan dikirim tiap tanggal 5 & 25."
        : "Notifikasi e-TPP dimatikan.",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update e-TPP template setting" },
      { status: 500 }
    );
  }
}
