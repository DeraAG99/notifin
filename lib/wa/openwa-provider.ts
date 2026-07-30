import type { SendResult, WaProvider } from "./provider";
import type { DeviceStatus } from "@/types";

export interface OpenWAConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

interface SessionResponse {
  id: string;
  name: string;
  status: "created" | "initializing" | "qr_ready" | "authenticating" | "ready" | "disconnected" | "action_required" | "failed";
  phone?: string | null;
  pushName?: string | null;
}

interface MessageResponse {
  messageId: string;
  timestamp: number;
}

interface QRCodeResponse {
  qrCode: string;
  status: string;
}

export class OpenWAProvider implements WaProvider {
  readonly name = "openwa" as const;
  private sessionId: string | null = null;

  constructor(private config: OpenWAConfig) {}

  private get headers() {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.config.apiKey,
    };
  }

  private get baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/api/${path.replace(/^\//, "")}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenWA API error: ${response.status} - ${text || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private async resolveSessionId(): Promise<string> {
    if (this.sessionId) return this.sessionId;

    const sessions = await this.request<SessionResponse[]>("GET", "sessions");
    const found = sessions.find((s) => s.name === this.config.session);
    if (found) {
      this.sessionId = found.id;
      return this.sessionId;
    }

    const created = await this.request<SessionResponse>("POST", "sessions", { name: this.config.session });
    this.sessionId = created.id;
    return this.sessionId;
  }

  private async ensureSession(): Promise<string> {
    return this.resolveSessionId();
  }

  private async startSession(sid: string): Promise<void> {
    try {
      await this.request("POST", `sessions/${sid}/start`);
    } catch {
      // session might already be running
    }
  }

  async sendText(phone: string, message: string): Promise<SendResult> {
    try {
      const sid = await this.ensureSession();

      const chatId = `${phone.replace(/[^0-9]/g, "")}@c.us`;
      const result = await this.request<MessageResponse>(
        "POST",
        `sessions/${sid}/messages/send-text`,
        { chatId, text: message }
      );
      return { success: true, messageId: result.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    try {
      const sid = await this.ensureSession();

      const chatId = `${phone.replace(/[^0-9]/g, "")}@c.us`;
      const result = await this.request<MessageResponse>(
        "POST",
        `sessions/${sid}/messages/send-image`,
        { chatId, url: fileUrl, caption: caption || "" }
      );
      return { success: true, messageId: result.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async checkConnection(): Promise<DeviceStatus> {
    try {
      const sid = await this.ensureSession();
      const result = await this.request<SessionResponse>("GET", `sessions/${sid}`);
      return { status: result.status === "ready" };
    } catch {
      return { status: false };
    }
  }

  async getQr(): Promise<string | null> {
    try {
      const sid = await this.ensureSession();
      await this.startSession(sid);

      const result = await this.request<QRCodeResponse>("GET", `sessions/${sid}/qr`);
      return result.qrCode || null;
    } catch {
      return null;
    }
  }
}
