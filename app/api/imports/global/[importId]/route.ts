import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataImports } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { importId } = await params;

    const [imported] = await db
      .delete(dataImports)
      .where(
        and(
          eq(dataImports.id, importId),
          eq(dataImports.adminId, session.adminId),
          eq(dataImports.scope, "global")
        )
      )
      .returning();

    if (!imported) {
      return NextResponse.json(
        { success: false, error: "Import not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Data global import dihapus",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete global import" },
      { status: 500 }
    );
  }
}
