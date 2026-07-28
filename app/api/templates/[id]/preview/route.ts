import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { templatePreviewSchema } from "@/lib/validations";
import { templateEngine } from "@/lib/template-engine";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sampleData } = templatePreviewSchema.parse(body);

    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
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
