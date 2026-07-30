import type { SendResult, WaProvider } from "./provider";
import type { DeviceStatus } from "@/types";

interface RateLimiter {
  tokens: number;
  lastRefill: number;
  readonly maxTokens: number;
  readonly refillRate: number;
}

export class FonnteProvider implements WaProvider {
  readonly name = "fonnte" as const;
  private baseUrl = "https://api.fonnte.com";
  private rateLimiter: RateLimiter;
  private maxRetries = 3;

  constructor(
    private token: string,
    rateLimitPerMinute = 100
  ) {
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
      this.rateLimiter.tokens = Math.min(this.rateLimiter.maxTokens, this.rateLimiter.tokens + tokensToAdd);
      this.rateLimiter.lastRefill = now;
    }

    if (this.rateLimiter.tokens <= 0) {
      const waitTime = Math.ceil((1 - this.rateLimiter.tokens) / this.rateLimiter.refillRate);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.rateLimiter.tokens = 1;
      this.rateLimiter.lastRefill = Date.now();
    }

    this.rateLimiter.tokens--;
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>, retries = 0): Promise<T> {
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
        throw new Error(`Fonnte API error: ${response.status} - ${(errorData as Record<string, string>).message || response.statusText}`);
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

  async sendText(phone: string, message: string): Promise<SendResult> {
    try {
      const result = await this.request<{ status: boolean; message: string; data?: { id: string } }>("/send", {
        target: phone,
        message,
        typing: true,
      });
      return { success: result.status, messageId: result.data?.id, error: result.status ? undefined : result.message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    try {
      const result = await this.request<{ status: boolean; message: string; data?: { id: string } }>("/send-media", {
        target: phone,
        url: fileUrl,
        caption: caption || "",
        typing: true,
      });
      return { success: result.status, messageId: result.data?.id, error: result.status ? undefined : result.message };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async checkConnection(): Promise<DeviceStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/device`, {
        method: "POST",
        headers: { Authorization: this.token },
      });

      if (!response.ok) return { status: false };

      const text = await response.text();
      try {
        return JSON.parse(text) as DeviceStatus;
      } catch {
        return { status: false };
      }
    } catch {
      return { status: false };
    }
  }
}
