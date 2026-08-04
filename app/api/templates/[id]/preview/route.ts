import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { templatePreviewSchema } from "@/lib/validations";
import { templateEngine } from "@/lib/template-engine";
import { and, eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const { sampleData } = templatePreviewSchema.parse(body);
    const scoped = isSuperadmin(session) ? undefined : eq(notificationTemplates.adminId, session.adminId);

    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.id, id), scoped))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const renderedText = templateEngine.render(template.content.text, sampleData);
    const renderedHtml = template.content.html
      ? templateEngine.render(template.content.html, sampleData)
      : undefined;

    const detectedVariables = templateEngine.validateVariables(template.content.text);

    return NextResponse.json({
      success: true,
      data: {
        original: template.content,
        rendered: { text: renderedText, html: renderedHtml },
        variables: detectedVariables,
        sampleData,
      },
    } satisfies ApiResponse);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to preview template" },
      { status: 500 }
    );
  }
}
