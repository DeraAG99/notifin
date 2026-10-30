import ExcelJS from "exceljs";
import type { NotificationLogEntry } from "@/types";
import type { LogFilterInput } from "@/lib/validations";

const statuses: Record<string, string> = {
  pending: "Menunggu", sent: "Terkirim", delivered: "Diterima", read: "Dibaca", failed: "Gagal",
};

// Excel dates have no timezone. Use a numeric serial so WIB output does not
// depend on the timezone of the Node process generating the file.
export function excelWibDate(value: Date | null) {
  return value ? new Date(value).getTime() / 86_400_000 + 25569 + 7 / 24 : null;
}

function cellText(value: string | null | undefined) {
  const text = (value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return text.length > 32767 ? `${text.slice(0, 32720)}\n[Teks dipotong: batas karakter Excel]` : text;
}

export function buildLogWorkbook(logs: NotificationLogEntry[], filters: LogFilterInput, tenant: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Notifin";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Log Notifikasi", {
    views: [{ state: "frozen", ySplit: 1, xSplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = ["No", "Tenant", "Penerima", "No. WhatsApp", "Email", "Template", "Channel", "Status", "Prioritas", "Dibuat (WIB)", "Dikirim (WIB)", "Diterima (WIB)", "Isi Pesan", "Error", "ID Log"];
  const widths = [6, 24, 28, 20, 32, 26, 18, 16, 12, 23, 23, 23, 70, 50, 38];
  sheet.columns = headers.map((header, index) => ({ header, width: widths[index] }));
  for (const [index, log] of logs.entries()) {
    const row = sheet.addRow([
      index + 1, cellText(log.adminName), cellText(log.recipientName), cellText(log.recipientPhone),
      cellText(log.recipientEmail), cellText(log.templateName),
      log.channel === "wa" ? "WhatsApp" : log.channel === "email" ? "Email" : "WhatsApp & Email",
      statuses[log.status || "pending"], log.priority || "normal",
      excelWibDate(log.createdAt), excelWibDate(log.sentAt), excelWibDate(log.deliveredAt),
      cellText(log.content?.text), cellText(log.error), log.id,
    ]);
    row.alignment = { vertical: "top", wrapText: true };
    // Keep long messages readable without allowing one row to fill the screen.
    const messageLines = Math.max(...[log.content?.text || "", log.error || ""].map((text) =>
      text.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 65)), 0)
    ));
    row.height = Math.min(120, Math.max(32, messageLines * 15));
    if (index % 2 === 1) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    for (const column of [4, 5, 15]) row.getCell(column).numFmt = "@";
    for (const column of [10, 11, 12]) row.getCell(column).numFmt = "dd/mm/yyyy hh:mm:ss";
    if (log.status === "failed") row.getCell(8).font = { color: { argb: "FFDC2626" }, bold: true };
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
  sheet.getRow(1).height = 30;
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };

  const summary = workbook.addWorksheet("Ringkasan");
  summary.columns = [{ width: 28 }, { width: 75 }];
  summary.addRows([
    ["Laporan Log Notifikasi"], ["Diekspor (WIB)", excelWibDate(new Date())], ["Tenant", tenant],
    ["Tanggal awal (WIB)", filters.startDate || "Semua"], ["Tanggal akhir (WIB)", filters.endDate || "Semua"],
    ["Channel", filters.channel || "Semua"], ["Status", filters.status ? statuses[filters.status] : "Semua"],
    ["Pencarian penerima", cellText(filters.search) || "-"], ["Jumlah log", logs.length],
    ["Catatan", "Seluruh hasil sesuai filter. Batas Excel 32.767 karakter/sel; teks yang melebihi batas dipotong dan diberi penanda."],
  ]);
  summary.mergeCells("A1:B1");
  summary.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0F766E" } };
  summary.getCell("B2").numFmt = "dd/mm/yyyy hh:mm:ss";
  summary.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; row.height = 30; });
  summary.getRow(10).height = 45;
  return workbook;
}
