import cron, { type ScheduledTask } from "node-cron";
import { db } from "../lib/db";
import {
  notificationLogs,
  notificationTemplates,
  settings,
  users,
} from "../lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { templateEngine } from "../lib/template-engine";
import { addNotificationJob, htmlForChannel } from "../lib/queue";
import { isAdminActive } from "../lib/admin-status";
import { ETPP_ENGINE, resolveImportVars } from "../lib/imports/variables";
import { dataImports } from "../lib/db/schema";
import type { NotificationTemplate } from "../types";

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "Asia/Jakarta";

/**
 * Tanggal 5 dan 25, pukul 08:00 waktu lokal admin.
 *
 * Not a daily job: the reminder is meaningless in the first week of the month,
 * and firing it 30x a month would burn the queue for nothing.
 */
const ETPP_CRON = "0 8 5,25 * *";

/** `settings` key holding the template this job renders, per admin. */
export const ETPP_TEMPLATE_SETTING_KEY = "etpp.templateId";

/** Metadata marker so a restart mid-window cannot double-send the same day. */
const LAST_SENT_KEY = "$last_etpp_sent";

/** 1-based day of month in the given timezone, matching the cron's own clock. */
function dayKeyIn(timezone: string): string {
  // en-CA renders as YYYY-MM-DD, which sorts and compares correctly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

class EtppNotificationScheduler {
  private task: ScheduledTask | null = null;

  start(): void {
    if (this.task) return;
    this.task = cron.schedule(ETPP_CRON, () => {
      void this.dispatch();
    });
    console.log(`[etpp] scheduled ${ETPP_CRON} (${DEFAULT_TIMEZONE})`);
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
  }

  /**
   * Resolve which admins actually want this job before doing any work, so the
   * cron tick stays cheap and each admin is only handled under its own tenant.
   */
  private async resolveTargets(): Promise<
    { adminId: string; template: NotificationTemplate }[]
  > {
    const configured = await db
      .select({ adminId: settings.adminId, value: settings.value })
      .from(settings)
      .where(eq(settings.key, ETPP_TEMPLATE_SETTING_KEY));

    if (configured.length === 0) return [];

    const templateIds = new Set(
      configured
        .map((r) => r.value)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    );
    if (templateIds.size === 0) return [];

    const templates = await db
      .select()
      .from(notificationTemplates)
      .where(inArray(notificationTemplates.id, [...templateIds]));

    return templates
      .filter((t) => t.isActive)
      .map((t) => ({ adminId: t.adminId, template: t as NotificationTemplate }));
  }

  private async dispatch(): Promise<void> {
    let targets: { adminId: string; template: NotificationTemplate }[];
    try {
      targets = await this.resolveTargets();
    } catch (error) {
      console.error("[etpp] gagal membaca konfigurasi:", error);
      return;
    }

    if (targets.length === 0) {
      console.log("[etpp] tidak ada template e-TPP terkonfigurasi, dilewati.");
      return;
    }

    for (const { adminId, template } of targets) {
      try {
        if (!(await isAdminActive(adminId))) continue;
        await this.sendForAdmin(adminId, template);
      } catch (error) {
        console.error(`[etpp] gagal mengirim untuk admin ${adminId}:`, error);
      }
    }
  }

  /**
   * Recipients are the active users who actually have an e-TPP file -- a
   * per-user import, or everyone when the admin uploaded a global one.
   *
   * Deliberately not keyed on a metadata flag: the e-TPP variables are rebuilt
   * from `data_imports.data` at send time, so the presence of that import is
   * both the only truthful gate and the one that cannot silently drop to zero.
   */
  private async resolveRecipients(adminId: string) {
    const imports = await db
      .select({ userId: dataImports.userId, scope: dataImports.scope })
      .from(dataImports)
      .where(
        and(eq(dataImports.adminId, adminId), eq(dataImports.engine, ETPP_ENGINE))
      );

    const hasGlobal = imports.some((row) => row.scope === "global");

    const userIds = [
      ...new Set(
        imports
          .map((row) => row.userId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];

    const scopeFilter = hasGlobal
      ? undefined
      : userIds.length > 0
        ? inArray(users.id, userIds)
        : null;

    if (scopeFilter === null) return [];

    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.adminId, adminId),
          eq(users.isActive, true),
          ...(scopeFilter ? [scopeFilter] : [])
        )
      );
  }

  private async sendForAdmin(
    adminId: string,
    template: NotificationTemplate
  ): Promise<void> {
    const today = dayKeyIn(DEFAULT_TIMEZONE);

    const recipients = await this.resolveRecipients(adminId);
    if (recipients.length === 0) {
      console.log(`[etpp] tidak ada user dengan import e-TPP untuk ${adminId}.`);
      return;
    }

    const channels: ("wa" | "email")[] =
      template.channel === "both" ? ["wa", "email"] : [template.channel];

    let sent = 0;
    let skipped = 0;

    for (const user of recipients) {
      const metadata = (user.metadata as Record<string, unknown>) || {};
      if (metadata[LAST_SENT_KEY] === today) {
        skipped += 1;
        continue;
      }

      const needsPhone = channels.includes("wa");
      const needsEmail = channels.includes("email");
      if ((needsPhone && !user.phone) || (needsEmail && !user.email)) {
        console.warn(
          `[etpp] ${user.name}: kontak kurang untuk channel ${channels.join("+")}, dilewati.`
        );
        skipped += 1;
        continue;
      }

      const variables = await resolveImportVars(user);
      const renderedContent = templateEngine.render(template.content.text, variables);
      // Rendered once per user, attached only to the email channel. WhatsApp
      // takes text only, so a template on `both` must not carry HTML into a
      // WA job. `undefined` (not "") keeps the worker's plain-text fallback
      // path intact for every template that has no HTML body.
      const renderedHtml = template.content.html
        ? templateEngine.render(template.content.html, variables)
        : undefined;

      for (const channel of channels) {
        const channelHtml = htmlForChannel(renderedHtml, channel);

        const [log] = await db
          .insert(notificationLogs)
          .values({
            adminId,
            templateId: template.id,
            userId: user.id,
            channel,
            priority: "normal",
            content: { text: renderedContent, html: channelHtml },
            status: "pending",
          })
          .returning();

        await addNotificationJob({
          type: channel === "wa" ? "send-wa" : "send-email",
          adminId,
          logId: log.id,
          templateId: template.id,
          userId: user.id,
          channel,
          priority: "normal",
          content: { text: renderedContent, html: channelHtml },
          subject: template.subject || undefined,
          recipientPhone: user.phone || undefined,
          recipientEmail: user.email || undefined,
          recipientName: user.name,
        });

        sent += 1;
      }

      await db
        .update(users)
        .set({
          metadata: { ...metadata, [LAST_SENT_KEY]: today },
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, user.id), eq(users.adminId, adminId)));
    }

    console.log(
      `[etpp] ${template.name}: ${sent} pesan terkirim, ${skipped} dilewati dari ${recipients.length} user.`
    );
  }
}

export const etppNotificationScheduler = new EtppNotificationScheduler();

export { ETPP_CRON, dayKeyIn, LAST_SENT_KEY };
