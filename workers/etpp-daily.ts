import cron, { type ScheduledTask } from "node-cron";
import { db } from "../lib/db";
import { users, notificationLogs } from "../lib/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { templateEngine } from "../lib/template-engine";
import { addNotificationJob } from "../lib/queue";

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Jakarta";

interface EtppEntry {
  rhk: string;
  target: string;
}

const DEFAULT_TEMPLATE = `Halo {{name}},

{{jabatan}} {{unitKerja}}.

Berikut adalah target kinerja untuk bulan {{bulan_ini}}:

🎯 Target RHK:
{{#each rhk_iku}}
- {{.}}
{{/each}}

🎯 Target Lainnya:
{{#each rhk_lainnya}}
- {{.}}
{{/each}}

Silakan laksanakan sesuai rencana masing-masing agar tepat waktu.

Salam,
Subbagian Keuangan`;

class EtppDailyScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private scheduledDates: Set<string> = new Set();

  private getDateKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private shouldRunToday(user: typeof users.$inferSelect): boolean {
    if (!user.isActive) return false;
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric" });
    const lastNotif = (user.metadata as Record<string, unknown>)?.$last_etpp_daily;
    return lastNotif !== today;
  }

  async scheduleDaily(): Promise<void> {
    const todayKey = this.getDateKey();
    if (this.scheduledDates.has(todayKey)) return;

    const task = cron.schedule("0 8 * * *", async () => {
      await this.sendDailyNotifications();
    }, { timezone: DEFAULT_TIMEZONE });

    this.tasks.set("etpp-daily", task);
    this.scheduledDates.add(todayKey);

    console.log("Scheduled e-TPP daily notification");
  }

  stop(): void {
    const task = this.tasks.get("etpp-daily");
    if (task) {
      task.stop();
      this.tasks.delete("etpp-daily");
    }
  }

  private async sendDailyNotifications(): Promise<void> {
    const usersWithEtpp = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          sql`${users.metadata}::jsonb ? 'etpp_imported'`
        )
      );

    console.log(`Sending e-TPP daily notifications to ${usersWithEtpp.length} users`);

    for (const user of usersWithEtpp) {
      if (!this.shouldRunToday(user)) continue;

      const metadata = (user.metadata as Record<string, unknown>) || {};
      const context = {
        name: user.name || "",
        jabatan: user.jabatan || "",
        unitKerja: user.unitKerja || "",
        bulan_ini: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        rhk_iku: Array.isArray(metadata.rhk_iku) ? metadata.rhk_iku : [],
        rhk_lainnya: Array.isArray(metadata.rhk_lainnya) ? metadata.rkh_lainnya : [],
      };

      const renderedContent = templateEngine.render(DEFAULT_TEMPLATE, context);

      const [log] = await db
        .insert(notificationLogs)
        .values({
          adminId: user.adminId,
          userId: user.id,
          channel: "wa",
          status: "pending",
          content: { text: renderedContent },
        })
        .returning();

      await addNotificationJob({
        type: "send-wa",
        templateId: "etpp-daily-template",
        adminId: user.adminId,
        logId: log.id,
        userId: user.id,
        channel: "wa",
        priority: "normal",
        content: { text: renderedContent },
        recipientPhone: user.phone || undefined,
        recipientName: user.name,
      });

      const newMetadata = {
        ...metadata,
        $last_etpp_daily: new Date().toISOString().slice(0, 10),
      };
      await db
        .update(users)
        .set({ metadata: newMetadata, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
  }
}

export const etppDailyScheduler = new EtppDailyScheduler();