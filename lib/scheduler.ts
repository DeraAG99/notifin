import cron, { type ScheduledTask } from "node-cron";
import { db } from "./db";
import {
  notificationSchedules,
  notificationTemplates,
  users,
  settings,
  admins,
  notificationLogs,
} from "./db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { addNotificationJob } from "./queue";
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

function calculateNextRun(cronExpression: string, timezone = DEFAULT_TIMEZONE): Date {
  try {
    const task = cron.createTask(cronExpression, () => {}, { timezone });
    task.start();
    const next = task.getNextRun();
    task.destroy();
    return next ?? new Date(Date.now() + 60 * 60 * 1000);
  } catch {
    return new Date(Date.now() + 60 * 60 * 1000);
  }
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
      const nextRun = calculateNextRun(schedule.cronExpression, timezone);
      await db
        .update(notificationSchedules)
        .set({ nextRunAt: nextRun })
        .where(eq(notificationSchedules.id, schedule.id));
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

      const channels: ("wa" | "email")[] =
        template.channel === "both" ? ["wa", "email"] : [template.channel];

      for (const ch of channels) {
        const [log] = await db
          .insert(notificationLogs)
          .values({
            adminId: schedule.adminId,
            templateId: template.id,
            userId: user.id,
            channel: ch,
            priority: "normal",
            content: { text: renderedContent },
            status: "pending",
          })
          .returning();

        await addNotificationJob({
          type: ch === "wa" ? "send-wa" : "send-email",
          adminId: schedule.adminId,
          logId: log.id,
          templateId: template.id,
          userId: user.id,
          channel: ch,
          priority: "normal",
          content: { text: renderedContent },
          subject: template.subject || undefined,
          recipientPhone: user.phone || undefined,
          recipientEmail: user.email || undefined,
          recipientName: user.name,
        });
      }

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
