import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationTemplates, users, dataImports, importCategories } from "@/lib/db/schema";
import { templatePreviewSchema } from "@/lib/validations";
import { templateEngine } from "@/lib/template-engine";
import { resolveImportVars } from "@/lib/imports/variables";
import { extractImportKeys } from "@/lib/imports/utils";
import { and, eq, inArray, sql } from "drizzle-orm";
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
    const { sampleData, userId } = templatePreviewSchema.parse(body);
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

    let variables: Record<string, unknown> = sampleData as Record<string, unknown>;

    if (userId) {
      const userScoped = isSuperadmin(session)
        ? undefined
        : eq(users.adminId, session.adminId);
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), userScoped))
        .limit(1);

      if (user) {
        variables = await resolveImportVars(user, sampleData as Record<string, unknown> | undefined);
      }
    }

    const renderedText = templateEngine.render(template.content.text, variables);
    const renderedHtml = template.content.html
      ? templateEngine.render(template.content.html, variables)
      : undefined;

    const detectedVariables = templateEngine.validateVariables(template.content.text);

    const importKeys = extractImportKeys(
      `${template.content.text} ${template.subject || ""}`
    );
    let coverage: { key: string; count: number; total: number }[] = [];

    if (importKeys.length > 0) {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.adminId, session.adminId),
            eq(users.isActive, true)
          )
        );
      const total = Number(totalResult.count);

      const keyRows = await db
        .select({ userId: dataImports.userId, categoryKey: importCategories.key })
        .from(dataImports)
        .innerJoin(importCategories, eq(dataImports.categoryId, importCategories.id))
        .where(
          and(
            eq(dataImports.adminId, session.adminId),
            inArray(importCategories.key, importKeys)
          )
        );

      const userKeys = new Map<string, Set<string>>();
      for (const row of keyRows) {
        if (!row.categoryKey) continue;
        const set = userKeys.get(row.userId) || new Set<string>();
        set.add(row.categoryKey);
        userKeys.set(row.userId, set);
      }

      coverage = importKeys.map((key) => ({
        key,
        count: Array.from(userKeys.values()).filter((s) => s.has(key)).length,
        total,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        original: template.content,
        rendered: { text: renderedText, html: renderedHtml },
        variables: detectedVariables,
        sampleData: variables,
        coverage,
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
