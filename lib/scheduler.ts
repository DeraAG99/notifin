import cron, { type ScheduledTask } from "node-cron";
import { db } from "./db";
import { notificationSchedules, notificationTemplates, users } from "./db/schema";
import { eq } from "drizzle-orm";
import { addNotificationJob, type NotificationJobData } from "./queue";
import { templateEngine } from "./template-engine";

interface ScheduleConfig {
  templateId: string;
  userId: string;
  cronExpression: string;
  isActive?: boolean;
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

function calculateNextRun(cronExpression: string): Date {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return new Date(Date.now() + 60 * 60 * 1000);

  const now = new Date();
  const next = new Date(now);

  if (parsed.minute === "*" && parsed.hour === "*") {
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return next;
  }

  if (parsed.minute !== "*") {
    const minute = parseInt(parsed.minute, 10);
    if (!isNaN(minute)) next.setMinutes(minute, 0, 0);
  }
  if (parsed.hour !== "*") {
    const hour = parseInt(parsed.hour, 10);
    if (!isNaN(hour)) next.setHours(hour);
  }

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();

  async loadSchedules(): Promise<void> {
    this.stopAll();

    const schedules = await db
      .select({
        id: notificationSchedules.id,
        templateId: notificationSchedules.templateId,
        userId: notificationSchedules.userId,
        cronExpression: notificationSchedules.cronExpression,
        isActive: notificationSchedules.isActive,
      })
      .from(notificationSchedules)
      .where(eq(notificationSchedules.isActive, true));

    for (const schedule of schedules) {
      this.scheduleJob(schedule.id, schedule.cronExpression);
    }

    console.log(`Loaded ${schedules.length} active schedules`);
  }

  scheduleJob(scheduleId: string, cronExpression: string): void {
    if (this.tasks.has(scheduleId)) {
      this.tasks.get(scheduleId)?.stop();
    }

    if (!cron.validate(cronExpression)) {
      console.error(
        `Invalid cron expression for schedule ${scheduleId}: ${cronExpression}`
      );
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      await this.processSchedule(scheduleId);
    });

    this.tasks.set(scheduleId, task);
  }

  async createSchedule(config: ScheduleConfig): Promise<void> {
    const nextRun = calculateNextRun(config.cronExpression);

    const [schedule] = await db
      .insert(notificationSchedules)
      .values({
        templateId: config.templateId,
        userId: config.userId,
        cronExpression: config.cronExpression,
        isActive: config.isActive ?? true,
        nextRunAt: nextRun,
      })
      .returning();

    if (config.isActive !== false) {
      this.scheduleJob(schedule.id, config.cronExpression);
    }

    console.log(`Created schedule ${schedule.id}`);
  }

  async updateSchedule(
    id: string,
    config: Partial<ScheduleConfig>
  ): Promise<void> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (config.cronExpression) {
      updateData.cronExpression = config.cronExpression;
      updateData.nextRunAt = calculateNextRun(config.cronExpression);
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
        this.scheduleJob(id, schedule[0].cronExpression);
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

      const renderedContent = templateEngine.render(template.content.text, {
        name: user.name,
        email: user.email,
        phone: user.phone,
      });

      const jobData: NotificationJobData = {
        type: template.channel === "wa" ? "send-wa" : "send-email",
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

      await db
        .update(notificationSchedules)
        .set({
          lastSentAt: new Date(),
          nextRunAt: calculateNextRun(schedule.cronExpression),
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
