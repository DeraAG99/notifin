import type { FonnteResponse, DeviceStatus } from "@/types";

interface RateLimiter {
  tokens: number;
  lastRefill: number;
  readonly maxTokens: number;
  readonly refillRate: number;
}

class FonnteClient {
  private token: string;
  private baseUrl = "https://api.fonnte.com";
  private rateLimiter: RateLimiter;
  private maxRetries = 3;

  constructor(token: string, rateLimitPerMinute = 100) {
    this.token = token;
    this.rateLimiter = {
      tokens: rateLimitPerMinute,
      lastRefill: Date.now(),
      maxTokens: rateLimitPerMinute,
      refillRate: rateLimitPerMinute / 60000,
    };
  }

  private async waitForToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.rateLimiter.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.rateLimiter.refillRate);

    if (tokensToAdd > 0) {
      this.rateLimiter.tokens = Math.min(
        this.rateLimiter.maxTokens,
        this.rateLimiter.tokens + tokensToAdd
      );
      this.rateLimiter.lastRefill = now;
    }

    if (this.rateLimiter.tokens <= 0) {
      const waitTime = Math.ceil(
        ((1 - this.rateLimiter.tokens) / this.rateLimiter.refillRate)
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimiter.tokens = 1;
      this.rateLimiter.lastRefill = Date.now();
    }

    this.rateLimiter.tokens--;
  }

  private async request<T>(
    endpoint: string,
    body: Record<string, unknown>,
    retries = 0
  ): Promise<T> {
    await this.waitForToken();

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: this.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Fonnte API error: ${response.status} - ${(errorData as Record<string, string>).message || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (retries < this.maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(endpoint, body, retries + 1);
      }
      throw error;
    }
  }

  async sendText(phone: string, message: string): Promise<FonnteResponse> {
    return this.request<FonnteResponse>("/send", {
      target: phone,
      message,
      typing: true,
    });
  }

  async sendMedia(
    phone: string,
    fileUrl: string,
    caption?: string
  ): Promise<FonnteResponse> {
    return this.request<FonnteResponse>("/send-media", {
      target: phone,
      url: fileUrl,
      caption: caption || "",
      typing: true,
    });
  }

  async sendTemplate(
    phone: string,
    templateId: string,
    params: Record<string, string>
  ): Promise<FonnteResponse> {
    return this.request<FonnteResponse>("/send-template", {
      target: phone,
      templateId,
      params: Object.entries(params).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }

  async checkDevice(): Promise<DeviceStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/device`, {
        method: "GET",
        headers: {
          Authorization: this.token,
        },
      });

      if (!response.ok) {
        return { status: false };
      }

      const data = await response.json();
      return data as DeviceStatus;
    } catch {
      return { status: false };
    }
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<{
    type: "status" | "message";
    messageId?: string;
    status?: string;
    phone?: string;
    message?: string;
  }> {
    const data = payload.data as Record<string, unknown> | undefined;

    if (payload.event === "message" && data) {
      return {
        type: "message",
        phone: String(data.sender || ""),
        message: String(data.message || ""),
      };
    }

    if (payload.event === "send-response" && data) {
      return {
        type: "status",
        messageId: String(data.id || ""),
        status: String(data.status || "unknown"),
      };
    }

    return { type: "status", status: "unknown" };
  }
}

let client: FonnteClient | null = null;

export function getFonnteClient(): FonnteClient {
  if (!client) {
    const token = process.env.FONNTE_TOKEN;
    if (!token) {
      throw new Error("FONNTE_TOKEN environment variable is required");
    }
    const rateLimit = parseInt(process.env.FONNTE_RATE_LIMIT || "100", 10);
    client = new FonnteClient(token, rateLimit);
  }
  return client;
}
