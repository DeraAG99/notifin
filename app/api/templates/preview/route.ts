import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { templateDraftPreviewSchema } from "@/lib/validations";
import { templateEngine } from "@/lib/template-engine";
import { resolveImportVars } from "@/lib/imports/variables";
import { and, eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";
import { getSession, unauthorizedResponse, isSuperadmin } from "@/lib/auth/api";

/**
 * Renders template content that has not been saved yet, against a real user's
 * data.
 *
 * The saved-template preview endpoint reads `template.content` from the
 * database, so it cannot show what the editor is about to save. This one takes
 * the body, which is what makes the editor's preview worth trusting: pick a user
 * and see the message they will actually receive, with their own e-TPP data.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { content, html, subject, sampleData, userId } =
      templateDraftPreviewSchema.parse(await request.json());

    let variables: Record<string, unknown> = sampleData;

    if (userId) {
      const userScoped = isSuperadmin(session)
        ? undefined
        : eq(users.adminId, session.adminId);

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), userScoped))
        .limit(1);

      if (!user) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      variables = await resolveImportVars(
        user,
        sampleData as Record<string, unknown>
      );
    }

    const renderedText = templateEngine.render(content, variables);
    const renderedHtml = html ? templateEngine.render(html, variables) : undefined;
    const renderedSubject = subject
      ? templateEngine.render(subject, variables)
      : undefined;

    return NextResponse.json({
      success: true,
      data: {
        rendered: { text: renderedText, html: renderedHtml, subject: renderedSubject },
        // Variables live in both bodies: a template can carry its whole message
        // in HTML and leave `text` as a plain-text fallback, so scanning only
        // one of them would leave the other one's tags unresolved in preview.
        variables: Array.from(
          new Set([
            ...templateEngine.validateVariables(content),
            ...(html ? templateEngine.validateVariables(html) : []),
          ])
        ),
        sampleData: variables,
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
