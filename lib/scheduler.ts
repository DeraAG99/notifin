import cron, { type ScheduledTask } from "node-cron";
import { db } from "./db";
import {
  notificationSchedules,
  notificationTemplates,
  users,
  settings,
  admins,
} from "./db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { addNotificationJob, type NotificationJobData } from "./queue";
import { templateEngine } from "./template-engine";
import { resolveImportVars } from "./imports/variables";
import { isAdminActive } from "./admin-status";

interface ScheduleConfig {
  adminId: string;
  templateId: string;
  userId: string;
  cronExpression: string;
  isActive?: boolean;
}

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Jakarta";

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

async function getAdminTimezone(adminId: string): Promise<string> {
  try {
    const [setting] = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.adminId, adminId),
          eq(settings.key, "defaultTimezone")
        )
      )
      .limit(1);
    const tz =
      typeof setting?.value === "string" ? setting.value : DEFAULT_TIMEZONE;
    return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function parseCronExpression(expr: string): {
  minute: string;
  hour: string;
  day: string;
  month: string;
  dayOfWeek: string;
} | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute: parts[0],
    hour: parts[1],
    day: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function matchesFieldValue(value: number, field: string, max: number, offset: number): boolean {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    const trimmed = part.trim();
    if (!trimmed) return false;
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map((p) => parseInt(p, 10));
      const a = (start ?? 0) + offset;
      const b = (end ?? max) + offset;
      return value >= a && value <= b;
    }
    return value === parseInt(trimmed, 10) + offset;
  });
}

function matchesDayOfMonth(date: Date, field: string): boolean {
  if (field === "*") return true;
  return field
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some((part) => {
      if (part === "L") {
        const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        return date.getUTCDate() === lastDay;
      }
      if (part.includes("-")) {
        const [start, end] = part.split("-").map((p) => parseInt(p, 10));
        return date.getUTCDate() >= (start ?? 0) && date.getUTCDate() <= (end ?? 31);
      }
      return date.getUTCDate() === parseInt(part, 10);
    });
}

function calculateNextRun(cronExpression: string, timezone = DEFAULT_TIMEZONE): Date {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return new Date(Date.now() + 60 * 60 * 1000);

  const now = new Date();
  const tzOffset = isValidTimezone(timezone) ? getTimezoneOffsetMinutes(now, timezone) : 0;
  // Virtual clock: its UTC wall-clock components match the target timezone
  const nowTz = new Date(now.getTime() + tzOffset * 60000);

  if (parsed.minute === "*" && parsed.hour === "*") {
    const next = new Date(nowTz);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(next.getUTCMinutes() + 1);
    return new Date(next.getTime() - tzOffset * 60000);
  }

  if (parsed.hour === "*") {
    const next = new Date(nowTz);
    next.setUTCSeconds(0, 0);
    if (/^\d+$/.test(parsed.minute)) next.setUTCMinutes(parseInt(parsed.minute, 10));
    if (next <= nowTz) next.setUTCHours(next.getUTCHours() + 1);
    return new Date(next.getTime() - tzOffset * 60000);
  }

  const minute = /^\d+$/.test(parsed.minute) ? parseInt(parsed.minute, 10) : 0;
  const hour = parseInt(parsed.hour, 10);

  for (let offset = 0; offset <= 400; offset++) {
    const candidate = new Date(nowTz);
    candidate.setUTCDate(nowTz.getUTCDate() + offset);
    candidate.setUTCSeconds(0, 0);
    candidate.setUTCMinutes(minute);
    candidate.setUTCHours(hour);

    if (candidate <= nowTz) continue;
    if (!matchesDayOfMonth(candidate, parsed.day)) continue;
    if (!matchesFieldValue(candidate.getUTCMonth() + 1, parsed.month, 12, 0)) continue;
    if (!matchesFieldValue(candidate.getUTCDay(), parsed.dayOfWeek, 6, 0)) continue;
    return new Date(candidate.getTime() - tzOffset * 60000);
  }

  return new Date(now.getTime() + 60 * 60 * 1000);
}

class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();

  async loadSchedules(): Promise<void> {
    this.stopAll();

    const schedules = await db
      .select({
        id: notificationSchedules.id,
        adminId: notificationSchedules.adminId,
        templateId: notificationSchedules.templateId,
        userId: notificationSchedules.userId,
        cronExpression: notificationSchedules.cronExpression,
        isActive: notificationSchedules.isActive,
      })
      .from(notificationSchedules)
      .innerJoin(admins, eq(notificationSchedules.adminId, admins.id))
      .where(
        and(
          eq(notificationSchedules.isActive, true),
          eq(admins.isActive, true),
          or(
            sql`${admins.expiresAt} IS NULL`,
            sql`${admins.expiresAt} > now()`
          )
        )
      );

    for (const schedule of schedules) {
      const timezone = await getAdminTimezone(schedule.adminId);
      this.scheduleJob(schedule.id, schedule.cronExpression, timezone);
    }

    console.log(`Loaded ${schedules.length} active schedules`);
  }

  scheduleJob(scheduleId: string, cronExpression: string, timezone = DEFAULT_TIMEZONE): void {
    if (this.tasks.has(scheduleId)) {
      this.tasks.get(scheduleId)?.stop();
    }

    if (!cron.validate(cronExpression)) {
      console.error(
        `Invalid cron expression for schedule ${scheduleId}: ${cronExpression}`
      );
      return;
    }

    if (!isValidTimezone(timezone)) {
      console.error(
        `Invalid timezone for schedule ${scheduleId}: ${timezone}. Falling back to ${DEFAULT_TIMEZONE}`
      );
      timezone = DEFAULT_TIMEZONE;
    }

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.processSchedule(scheduleId);
      },
      { timezone }
    );

    this.tasks.set(scheduleId, task);
  }

  async createSchedule(config: ScheduleConfig): Promise<void> {
    const timezone = await getAdminTimezone(config.adminId);
    const nextRun = calculateNextRun(config.cronExpression, timezone);

    const [schedule] = await db
      .insert(notificationSchedules)
      .values({
        adminId: config.adminId,
        templateId: config.templateId,
        userId: config.userId,
        cronExpression: config.cronExpression,
        isActive: config.isActive ?? true,
        nextRunAt: nextRun,
      })
      .returning();

    if (config.isActive !== false) {
      this.scheduleJob(schedule.id, config.cronExpression, timezone);
    }

    console.log(`Created schedule ${schedule.id}`);
  }

  async updateSchedule(
    id: string,
    config: Partial<ScheduleConfig>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (config.cronExpression) {
      const timezone = config.adminId
        ? await getAdminTimezone(config.adminId)
        : DEFAULT_TIMEZONE;
      updateData.cronExpression = config.cronExpression;
      updateData.nextRunAt = calculateNextRun(config.cronExpression, timezone);
    }
    if (config.isActive !== undefined) {
      updateData.isActive = config.isActive;
    }

    await db
      .update(notificationSchedules)
      .set(updateData)
      .where(eq(notificationSchedules.id, id));

    if (config.cronExpression || config.isActive !== undefined) {
      const schedule = await db
        .select()
        .from(notificationSchedules)
        .where(eq(notificationSchedules.id, id))
        .limit(1);

      if (schedule[0]?.isActive) {
        const timezone = await getAdminTimezone(schedule[0].adminId);
        this.scheduleJob(id, schedule[0].cronExpression, timezone);
      } else {
        this.stopJob(id);
      }
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    this.stopJob(id);
    await db
      .delete(notificationSchedules)
      .where(eq(notificationSchedules.id, id));
    console.log(`Deleted schedule ${id}`);
  }

  async processSchedule(scheduleId: string): Promise<void> {
    try {
      const [schedule] = await db
        .select()
        .from(notificationSchedules)
        .where(eq(notificationSchedules.id, scheduleId))
        .limit(1);

      if (!schedule || !schedule.isActive) return;

      if (!(await isAdminActive(schedule.adminId))) return;

      const [template] = await db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.id, schedule.templateId))
        .limit(1);

      if (!template || !template.isActive) return;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, schedule.userId))
        .limit(1);

      if (!user || !user.isActive) return;

      const variables = await resolveImportVars(user);
      const renderedContent = templateEngine.render(
        template.content.text,
        variables
      );

      const jobData: NotificationJobData = {
        type: template.channel === "wa" ? "send-wa" : "send-email",
        adminId: schedule.adminId,
        logId: scheduleId,
        templateId: template.id,
        userId: user.id,
        channel: template.channel as "wa" | "email",
        priority: "normal",
        content: { text: renderedContent },
        subject: template.subject || undefined,
        recipientPhone: user.phone || undefined,
        recipientEmail: user.email || undefined,
        recipientName: user.name,
      };

      await addNotificationJob(jobData);

      const timezone = await getAdminTimezone(schedule.adminId);
      await db
        .update(notificationSchedules)
        .set({
          lastSentAt: new Date(),
          nextRunAt: calculateNextRun(schedule.cronExpression, timezone),
        })
        .where(eq(notificationSchedules.id, scheduleId));

      console.log(`Processed schedule ${scheduleId}`);
    } catch (error) {
      console.error(`Error processing schedule ${scheduleId}:`, error);
    }
  }

  private stopJob(scheduleId: string): void {
    const task = this.tasks.get(scheduleId);
    if (task) {
      task.stop();
      this.tasks.delete(scheduleId);
    }
  }

  stopAll(): void {
    for (const [, task] of this.tasks) {
      task.stop();
    }
    this.tasks.clear();
  }

  getActiveTaskCount(): number {
    return this.tasks.size;
  }
}

export const scheduler = new SchedulerService();
