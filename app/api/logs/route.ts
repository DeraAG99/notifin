import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";
import { listLogs } from "@/lib/db/logs";
import { parseLogFilters } from "@/lib/log-filters";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    const filters = parseLogFilters(new URL(request.url).searchParams);
    return NextResponse.json({ success: true, data: await listLogs(filters, session) });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ success: false, error: (error as ZodError).issues[0]?.message || "Filter tidak valid" }, { status: 400 });
    }
    console.error("Failed to fetch logs:", error);
    return NextResponse.json({ success: false, error: "Gagal memuat log" }, { status: 500 });
  }
}
