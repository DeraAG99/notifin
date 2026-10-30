import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getSession, unauthorizedResponse } from "@/lib/auth/api";
import { exportLogs } from "@/lib/db/logs";
import { parseLogFilters } from "@/lib/log-filters";
import { buildLogWorkbook } from "@/lib/log-export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();
    const filters = parseLogFilters(new URL(request.url).searchParams);
    const logs = await exportLogs(filters, session);
    if (logs.length > 1_048_575) {
      return NextResponse.json({ success: false, error: "Hasil melebihi batas baris Excel. Persempit rentang tanggal." }, { status: 400 });
    }
    const tenant = session.role === "superadmin"
      ? filters.adminId ? logs[0]?.adminName || filters.adminId : "Semua tenant"
      : session.name;
    const workbook = buildLogWorkbook(logs, filters, tenant);
    const data = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="log-notifikasi-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ success: false, error: (error as ZodError).issues[0]?.message || "Filter tidak valid" }, { status: 400 });
    }
    console.error("Failed to export logs:", error);
    return NextResponse.json({ success: false, error: "Gagal mengekspor log" }, { status: 500 });
  }
}
