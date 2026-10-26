import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { settings as settingsTable } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { renderWelcomeEmail, renderNotificationEmail } from "./email-templates";

/**
 * Token Bucket Rate Limiter for Resend API
 * Shared across all sendViaResend calls in this process
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRatePerMs: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async take(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Wait for next token to become available
      const waitMs = (1 - this.tokens) / this.refillRatePerMs;
      await sleep(Math.ceil(waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Configure from env (defaults for Resend Free tier: 2 req/sec, burst 5)
const RESEND_RPS = Number(process.env.RESEND_RATE_LIMIT_RPS) || 2;
const RESEND_BURST = Number(process.env.RESEND_RATE_LIMIT_BURST) || 5;
const resendLimiter = new TokenBucket(RESEND_BURST, RESEND_RPS / 1000);

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

  // Retry configuration
  const MAX_RETRIES = 2;
  let attempt = 0;

  while (true) {
    // Wait for rate limiter token before each attempt
    await resendLimiter.take();

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

      if (res.ok) {
        return { id: data?.id || "", success: true };
      }

      // Handle rate limit (429) with Retry-After header
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("Retry-After");
        let delayMs = 5000; // default 5s
        if (retryAfterHeader) {
          const retryAfterSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(retryAfterSec)) {
            delayMs = retryAfterSec * 1000;
          }
        }
        // Exponential backoff: 5s, 10s, 20s... but cap at Retry-After if provided
        const backoffMs = Math.min(delayMs, 5000 * Math.pow(2, attempt));
        console.warn(`[Resend] Rate limited (429). Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }

      return {
        id: "",
        success: false,
        error: data?.message || `Resend error ${res.status}`,
      };
    } catch (error) {
      // Network error - retry with backoff
      if (attempt < MAX_RETRIES) {
        const backoffMs = 5000 * Math.pow(2, attempt);
        console.warn(`[Resend] Network error: ${error instanceof Error ? error.message : "unknown"}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoffMs);
        attempt++;
        continue;
      }
      return {
        id: "",
        success: false,
        error: error instanceof Error ? error.message : "Failed to send via Resend",
      };
    }
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

export interface EmailHealthResult {
  ok: boolean;
  detail: string | null;
}

const RESEND_HEALTH_TTL_MS = 60_000;
let resendHealthCache: { at: number; result: EmailHealthResult } | null = null;

async function checkResendHealth(): Promise<EmailHealthResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, detail: "RESEND_API_KEY belum di-set di server" };
  }

  if (resendHealthCache && Date.now() - resendHealthCache.at < RESEND_HEALTH_TTL_MS) {
    return resendHealthCache.result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let result: EmailHealthResult;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (res.ok || res.status === 403) {
      result = { ok: true, detail: null };
    } else if (res.status === 401) {
      result = { ok: false, detail: "Key API Resend tidak valid (401)" };
    } else {
      result = { ok: false, detail: `Resend API error ${res.status}` };
    }
  } catch (err) {
    result = {
      ok: false,
      detail: `Gagal menghubungi Resend: ${err instanceof Error ? err.message : "network error"}`,
    };
  } finally {
    clearTimeout(timer);
  }

  resendHealthCache = { at: Date.now(), result };
  return result;
}

export async function checkEmailHealthDetailed(adminId: string): Promise<EmailHealthResult> {
  try {
    const provider = await getEmailProvider(adminId);
    if (provider === "resend") {
      return await checkResendHealth();
    }
    const transport = await getTransporter(adminId);
    if (!transport) {
      return { ok: false, detail: "SMTP belum dikonfigurasi" };
    }
    await transport.verify();
    return { ok: true, detail: null };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Verifikasi email gagal",
    };
  }
}

export async function checkEmailHealth(adminId: string): Promise<boolean> {
  const result = await checkEmailHealthDetailed(adminId);
  return result.ok;
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
