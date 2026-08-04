import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { settings as settingsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { renderWelcomeEmail, renderNotificationEmail } from "./email-templates";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

interface EmailResponse {
  id: string;
  success: boolean;
  error?: string;
}

export type SmtpSecure = "ssl" | "starttls" | "none";

interface SmtpConfig {
  host: string;
  port: number;
  secure: SmtpSecure;
  user?: string;
  pass?: string;
  from?: string;
}

let transporter: nodemailer.Transporter | null = null;
let cachedConfig: SmtpConfig | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function getSetting(key: string): Promise<string | number | boolean | null> {
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const [dbHost, dbPort, dbUser, dbPass, dbSecure, dbFrom] = await Promise.all([
    getSetting("smtpHost"),
    getSetting("smtpPort"),
    getSetting("smtpUser"),
    getSetting("smtpPass"),
    getSetting("smtpSecure"),
    getSetting("emailFrom"),
  ]);

  const host = (dbHost as string) || process.env.SMTP_HOST;
  if (!host) {
    cachedConfig = null;
    return null;
  }

  const port = Number(dbPort) || parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = (dbSecure as SmtpSecure) || (port === 465 ? "ssl" : "starttls");
  const user = (dbUser as string) || process.env.SMTP_USER;
  const pass = (dbPass as string) || process.env.SMTP_PASS;

  cachedConfig = {
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from: (dbFrom as string) || process.env.EMAIL_FROM,
  };
  cachedAt = Date.now();
  return cachedConfig;
}

export function resetEmailTransporter(): void {
  transporter = null;
  cachedConfig = null;
  cachedAt = 0;
}

function buildTransporter(config: SmtpConfig): nodemailer.Transporter {
  const secure = config.secure === "ssl";
  const tlsOptions =
    config.secure === "ssl"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false, requireTLS: config.secure === "starttls" };

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    tls: tlsOptions,
  });
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const config = await getSmtpConfig();
  if (!config) return null;

  if (!transporter) {
    transporter = buildTransporter(config);
  }
  return transporter;
}

function getFromAddress(config: SmtpConfig): string {
  return config.from || config.user || "notifications@notifin.app";
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResponse> {
  const transport = await getTransporter();
  if (!transport) {
    return {
      id: "",
      success: false,
      error: "SMTP not configured",
    };
  }

  const config = await getSmtpConfig();

  try {
    const info = await transport.sendMail({
      from: params.from || (config ? getFromAddress(config) : "notifications@notifin.app"),
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      attachments: params.attachments,
    });

    return {
      id: info.messageId,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    return {
      id: "",
      success: false,
      error: message,
    };
  }
}

export async function sendBulkEmail(
  emails: SendEmailParams[]
): Promise<EmailResponse[]> {
  const results = await Promise.allSettled(
    emails.map((params) => sendEmail(params))
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      id: "",
      success: false,
      error: result.reason?.message || "Failed to send email",
    };
  });
}

export async function checkEmailHealth(): Promise<boolean> {
  try {
    const transport = await getTransporter();
    if (!transport) return false;
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<EmailResponse> {
  const html = await renderWelcomeEmail(name);
  return sendEmail({
    to,
    subject: "Welcome to Notifin",
    html,
  });
}

export async function sendNotificationEmail(
  to: string,
  title: string,
  message: string,
  recipientName?: string
): Promise<EmailResponse> {
  const html = await renderNotificationEmail(title, message, recipientName);
  return sendEmail({
    to,
    subject: title,
    html,
  });
}
