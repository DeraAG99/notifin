import nodemailer from "nodemailer";
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

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) {
      throw new Error("SMTP_HOST environment variable is required");
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || "notifications@notifin.app";
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResponse> {
  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from: params.from || getFromAddress(),
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
    const transport = getTransporter();
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
