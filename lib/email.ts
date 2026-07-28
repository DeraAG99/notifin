import { Resend } from "resend";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

interface EmailResponse {
  id: string;
  success: boolean;
  error?: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || "notifications@notifin.app";
}

export async function sendEmail(params: SendEmailParams): Promise<EmailResponse> {
  const resend = getResendClient();

  try {
    const payload: Record<string, unknown> = {
      from: params.from || getFromAddress(),
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
    };

    if (params.html) {
      payload.html = params.html;
    }
    if (params.text) {
      payload.text = params.text;
    }
    if (params.replyTo) {
      payload.replyTo = params.replyTo;
    }

    const result = await resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0]);

    if (result.error) {
      return {
        id: "",
        success: false,
        error: result.error.message || "Unknown email error",
      };
    }

    return {
      id: result.data?.id || "",
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
    const resend = getResendClient();
    await resend.apiKeys.list();
    return true;
  } catch {
    return false;
  }
}
