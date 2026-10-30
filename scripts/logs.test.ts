import { describe, expect, test } from "bun:test";
import { PgDialect } from "drizzle-orm/pg-core";
import ExcelJS from "exceljs";
import { parseLogFilters, logDateBoundary } from "../lib/log-filters";
import { logConditions } from "../lib/db/logs";
import { buildLogWorkbook, excelWibDate } from "../lib/log-export";
import type { NotificationLogEntry } from "../types";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const session = { adminId: tenantA, role: "admin", name: "Tenant A", email: "a@example.com" };
const filters = (query = "") => parseLogFilters(new URLSearchParams(query));
const compile = (query = "", role = "admin") => new PgDialect().sqlToQuery(logConditions(filters(query), { ...session, role })!);

describe("log date and status filters", () => {
  test("accepts HTML calendar dates and all supported statuses", () => {
    for (const status of ["pending", "sent", "delivered", "read", "failed"] as const) {
      expect(filters(`startDate=2026-10-01&endDate=2026-10-30&status=${status}`).status).toBe(status);
    }
  });
  test("rejects reversed ranges, invalid dates and unknown statuses", () => {
    for (const query of ["startDate=2026-10-31&endDate=2026-10-01", "startDate=2026-02-30", "status=success"]) {
      expect(() => filters(query)).toThrow();
    }
  });
  test("same-day ranges include the full calendar day in WIB", () => {
    expect(filters("startDate=2026-10-30&endDate=2026-10-30").startDate).toBe("2026-10-30");
    expect(logDateBoundary("2026-10-30").date.toISOString()).toBe("2026-10-29T17:00:00.000Z");
    const end = logDateBoundary("2026-10-30", true);
    expect(end.date.toISOString()).toBe("2026-10-30T17:00:00.000Z");
    expect(end.exclusive).toBe(true);
    expect(compile("startDate=2026-10-30&endDate=2026-10-30").sql).toContain('"created_at" <');
  });
  test("handles month/year rollover and leap days", () => {
    expect(logDateBoundary("2026-12-31", true).date.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(logDateBoundary("2024-02-29", true).date.toISOString()).toBe("2024-02-29T17:00:00.000Z");
  });
  test("keeps ISO datetime compatibility with inclusive timestamp ends", () => {
    expect(filters("startDate=2026-10-30T00%3A00%3A00Z").startDate).toBe("2026-10-30T00:00:00Z");
    expect(logDateBoundary("2026-10-30T12:00:00Z", true).exclusive).toBe(false);
    expect(compile("endDate=2026-10-30T12%3A00%3A00Z").sql).toContain('"created_at" <=');
  });
  test("empty filters reset without invalid enum values", () => {
    expect(filters("status=&channel=&startDate=&endDate=")).toEqual({ page: 1, pageSize: 20 });
  });
});

describe("shared tenant/status query predicates (no database calls)", () => {
  test("regular admins cannot request another tenant", () => {
    const query = compile(`adminId=${tenantB}&status=failed&channel=wa`);
    expect(query.params).toEqual([tenantA, "wa", "failed"]);
    expect(query.params).not.toContain(tenantB);
  });
  test("superadmin can filter a tenant or see all", () => {
    expect(compile(`adminId=${tenantB}`, "superadmin").params).toEqual([tenantB]);
    expect(logConditions(filters(), { ...session, role: "superadmin" })).toBeUndefined();
  });
  test("search is parameterized and treats wildcard characters literally", () => {
    const query = compile("search=100%25_a");
    expect(query.params).toEqual([tenantA, "%100\\%\\_a%", "%100\\%\\_a%", "%100\\%\\_a%"]);
  });
});

const log: NotificationLogEntry = {
  id: "log-1", adminId: tenantA, adminName: "Tenant A", recipientName: "Budi", recipientPhone: "08123456789",
  recipientEmail: "budi@example.com", templateName: "Pengingat", templateId: null, userId: "user-1",
  channel: "wa", status: "failed", priority: "normal", content: { text: 'Halo, "Budi"\nBaris kedua' },
  error: "Gagal", metadata: null, createdAt: new Date("2026-10-30T16:59:59Z"), sentAt: null, deliveredAt: null,
};

describe("Excel log report", () => {
  test("exports more than one page with styled headers, wrap, filters and frozen panes", () => {
    const workbook = buildLogWorkbook(Array.from({ length: 45 }, (_, index) => ({ ...log, id: `log-${index}` })), filters("status=failed"), "Tenant A");
    const sheet = workbook.getWorksheet("Log Notifikasi")!;
    expect(sheet.rowCount).toBe(46);
    expect(sheet.getRow(1).font.bold).toBe(true);
    expect(sheet.getRow(2).alignment.wrapText).toBe(true);
    expect(sheet.views[0].state).toBe("frozen");
    expect(sheet.autoFilter).toBeDefined();
    expect(sheet.getCell("D2").value).toBe("08123456789");
    expect(sheet.getCell("M2").value).toBe(log.content!.text);
    expect(workbook.getWorksheet("Ringkasan")!.getCell("B9").value).toBe(45);
  });
  test("round-trips valid XLSX and keeps formula-like content as plain text", async () => {
    const workbook = buildLogWorkbook([{ ...log, content: { text: '=HYPERLINK("https://example.com")' } }], filters(), "Tenant A");
    const data = await workbook.xlsx.writeBuffer();
    const read = new ExcelJS.Workbook();
    await read.xlsx.load(data);
    expect(read.getWorksheet("Log Notifikasi")!.getCell("M2").value).toBe('=HYPERLINK("https://example.com")');
    expect(read.getWorksheet("Log Notifikasi")!.getCell("D2").value).toBe("08123456789");
  });
  test("uses WIB date serials independent of host timezone", () => {
    expect(excelWibDate(new Date("2026-10-29T17:00:00Z"))).toBeCloseTo(Date.UTC(2026, 9, 30) / 86_400_000 + 25569, 8);
    expect(excelWibDate(null)).toBeNull();
  });
  test("handles empty results and marks Excel cell-length truncation", async () => {
    expect(buildLogWorkbook([], filters(), "Semua tenant").getWorksheet("Log Notifikasi")!.rowCount).toBe(1);
    const workbook = buildLogWorkbook([{ ...log, content: { text: "a".repeat(40_000) } }], filters(), "Tenant A");
    const text = workbook.getWorksheet("Log Notifikasi")!.getCell("M2").value as string;
    expect(text.length).toBeLessThanOrEqual(32767);
    expect(text).toContain("Teks dipotong");
    expect((await workbook.xlsx.writeBuffer()).byteLength).toBeGreaterThan(0);
  });
});
