import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { settings as settingsTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
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
  fromName?: string;
}

const transporters = new Map<string, nodemailer.Transporter>();
const cachedConfigs = new Map<string, { config: SmtpConfig | null; at: number }>();
const cachedProviders = new Map<string, { provider: "smtp" | "resend"; at: number }>();
const CACHE_TTL_MS = 60_000;

async function getSetting(adminId: string, key: string): Promise<string | number | boolean | null> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(and(eq(settingsTable.adminId, adminId), eq(settingsTable.key, key)));
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function getEmailProvider(adminId: string): Promise<"smtp" | "resend"> {
  const cached = cachedProviders.get(adminId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.provider;

  const value = await getSetting(adminId, "emailProvider");
  const provider: "smtp" | "resend" = value === "resend" ? "resend" : "smtp";
  cachedProviders.set(adminId, { provider, at: Date.now() });
  return provider;
}

async function getSmtpConfig(adminId: string): Promise<SmtpConfig | null> {
  const cached = cachedConfigs.get(adminId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.config;
  }

  const [dbHost, dbPort, dbUser, dbPass, dbSecure, dbFrom, dbFromName] = await Promise.all([
    getSetting(adminId, "smtpHost"),
    getSetting(adminId, "smtpPort"),
    getSetting(adminId, "smtpUser"),
    getSetting(adminId, "smtpPass"),
    getSetting(adminId, "smtpSecure"),
    getSetting(adminId, "emailFrom"),
    getSetting(adminId, "emailFromName"),
  ]);

  const host = (dbHost as string) || process.env.SMTP_HOST;
  if (!host) {
    cachedConfigs.set(adminId, { config: null, at: Date.now() });
    return null;
  }

  const port = Number(dbPort) || parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = (dbSecure as SmtpSecure) || (port === 465 ? "ssl" : "starttls");
  const user = (dbUser as string) || process.env.SMTP_USER;
  const pass = (dbPass as string) || process.env.SMTP_PASS;

  const config: SmtpConfig = {
    host,
    port,
    secure,
    user: user || undefined,
    pass: pass || undefined,
    from: (dbFrom as string) || process.env.EMAIL_FROM,
    fromName: (dbFromName as string) || process.env.EMAIL_FROM_NAME,
  };
  cachedConfigs.set(adminId, { config, at: Date.now() });
  return config;
}

export function resetEmailTransporter(adminId?: string): void {
  if (adminId) {
    transporters.delete(adminId);
    cachedConfigs.delete(adminId);
    cachedProviders.delete(adminId);
  } else {
    transporters.clear();
    cachedConfigs.clear();
    cachedProviders.clear();
  }
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

async function getTransporter(adminId: string): Promise<nodemailer.Transporter | null> {
  const config = await getSmtpConfig(adminId);
  if (!config) return null;

  let transport = transporters.get(adminId);
  if (!transport) {
    transport = buildTransporter(config);
    transporters.set(adminId, transport);
  }
  return transport;
}

function getFromAddress(config: SmtpConfig): string {
  const addr = config.from || config.user || "notifications@notifin.app";
  if (config.fromName) {
    return `"${config.fromName.replace(/"/g, "")}" <${addr}>`;
  }
  return addr;
}

async function sendViaResend(adminId: string, params: SendEmailParams): Promise<EmailResponse> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { id: "", success: false, error: "Resend not configured (RESEND_API_KEY)" };
  }

  const fromName = await getSetting(adminId, "emailFromName");
  const fromBase =
    process.env.RESEND_FROM || process.env.EMAIL_FROM || "Notifin <notifications@notifin.app>";
  let from = fromBase;
  if (fromName) {
    const addrMatch = fromBase.match(/<([^>]+)>/);
    const addr = addrMatch ? addrMatch[1] : fromBase;
    from = `"${String(fromName).replace(/"/g, "")}" <${addr}>`;
  }

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
  };
  if (params.html) body.html = params.html;
  if (params.text) body.text = params.text;
  if (params.replyTo) body.reply_to = params.replyTo;
  if (params.attachments && params.attachments.length > 0) {
    body.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: typeof a.content === "string" ? a.content : Buffer.from(a.content).toString("base64"),
    }));
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        id: "",
        success: false,
        error: data?.message || `Resend error ${res.status}`,
      };
    }
    return { id: data?.id || "", success: true };
  } catch (error) {
    return {
      id: "",
      success: false,
      error: error instanceof Error ? error.message : "Failed to send via Resend",
    };
  }
}

export async function sendEmail(adminId: string, params: SendEmailParams): Promise<EmailResponse> {
  const provider = await getEmailProvider(adminId);
  if (provider === "resend") {
    return sendViaResend(adminId, params);
  }

  const transport = await getTransporter(adminId);
  if (!transport) {
    return {
      id: "",
      success: false,
      error: "SMTP not configured",
    };
  }

  const config = await getSmtpConfig(adminId);

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
  adminId: string,
  emails: SendEmailParams[]
): Promise<EmailResponse[]> {
  const results = await Promise.allSettled(
    emails.map((params) => sendEmail(adminId, params))
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

export async function checkEmailHealth(adminId: string): Promise<boolean> {
  try {
    const provider = await getEmailProvider(adminId);
    if (provider === "resend") {
      return !!process.env.RESEND_API_KEY;
    }
    const transport = await getTransporter(adminId);
    if (!transport) return false;
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendWelcomeEmail(adminId: string, to: string, name: string): Promise<EmailResponse> {
  const html = await renderWelcomeEmail(name);
  return sendEmail(adminId, {
    to,
    subject: "Welcome to Notifin",
    html,
  });
}

export async function sendNotificationEmail(
  adminId: string,
  to: string,
  title: string,
  message: string,
  recipientName?: string
): Promise<EmailResponse> {
  const html = await renderNotificationEmail(title, message, recipientName);
  return sendEmail(adminId, {
    to,
    subject: title,
    html,
  });
}
