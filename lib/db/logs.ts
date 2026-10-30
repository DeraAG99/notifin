import { and, desc, eq, getTableColumns, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { admins, notificationLogs, notificationTemplates, users } from "@/lib/db/schema";
import type { SessionPayload } from "@/lib/auth/api";
import type { LogFilterInput } from "@/lib/validations";
import { logDateBoundary } from "@/lib/log-filters";

export function logConditions(filters: LogFilterInput, session: SessionPayload) {
  const conditions: SQL[] = [];
  // Never trust a tenant ID supplied by a regular admin.
  const adminId = session.role === "superadmin" ? filters.adminId : session.adminId;
  if (adminId) conditions.push(eq(notificationLogs.adminId, adminId));
  if (filters.channel) conditions.push(eq(notificationLogs.channel, filters.channel));
  if (filters.status) conditions.push(eq(notificationLogs.status, filters.status));
  if (filters.userId) conditions.push(eq(notificationLogs.userId, filters.userId));
  if (filters.startDate) conditions.push(gte(notificationLogs.createdAt, logDateBoundary(filters.startDate).date));
  if (filters.endDate) {
    const end = logDateBoundary(filters.endDate, true);
    conditions.push(end.exclusive ? lt(notificationLogs.createdAt, end.date) : lte(notificationLogs.createdAt, end.date));
  }
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.phone, pattern), ilike(users.email, pattern))!);
  }
  return and(...conditions);
}

function logQuery(where: SQL | undefined) {
  return db.select({
    ...getTableColumns(notificationLogs),
    adminName: admins.name,
    recipientName: users.name,
    recipientPhone: users.phone,
    recipientEmail: users.email,
    templateName: notificationTemplates.name,
  }).from(notificationLogs)
    .leftJoin(admins, eq(admins.id, notificationLogs.adminId))
    .leftJoin(users, and(eq(users.id, notificationLogs.userId), eq(users.adminId, notificationLogs.adminId)))
    .leftJoin(notificationTemplates, and(eq(notificationTemplates.id, notificationLogs.templateId), eq(notificationTemplates.adminId, notificationLogs.adminId)))
    .where(where)
    .orderBy(desc(notificationLogs.createdAt), desc(notificationLogs.id));
}

export async function listLogs(filters: LogFilterInput, session: SessionPayload) {
  const where = logConditions(filters, session);
  const [count] = await db.select({ count: sql<number>`count(*)` }).from(notificationLogs)
    .leftJoin(users, and(eq(users.id, notificationLogs.userId), eq(users.adminId, notificationLogs.adminId)))
    .where(where);
  const total = Number(count.count);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const items = await logQuery(where).limit(filters.pageSize).offset((page - 1) * filters.pageSize);
  return { items, total, page, pageSize: filters.pageSize, totalPages };
}

export function exportLogs(filters: LogFilterInput, session: SessionPayload) {
  return logQuery(logConditions(filters, session));
}

export function listLogTenants() {
  return db.select({ id: admins.id, name: admins.name, email: admins.email })
    .from(admins).orderBy(admins.name, admins.id);
}
