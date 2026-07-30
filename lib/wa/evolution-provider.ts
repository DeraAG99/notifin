import type { SendResult, WaProvider } from "./provider";
import type { DeviceStatus } from "@/types";

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
  defaultDelay?: number; // <-- TAMBAHKAN
}

export class EvolutionProvider implements WaProvider {
  readonly name = "evolution" as const;

  constructor(private config: EvolutionConfig) {}

  private get headers() {
    return {
      "Content-Type": "application/json",
      "apiKey": this.config.apiKey,
    };
  }

  private get encInstance(): string {
    return encodeURIComponent(this.config.instance);
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    const response = await fetch(url, {
      method,
      headers: this.headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Evolution API error: ${response.status} - ${text || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async sendText(phone: string, message: string, options?: { delay?: number; linkPreview?: boolean }): Promise<SendResult> {
    try {
      const result = await this.request<{ key?: { id: string } }>(
        "POST",
        `/message/sendText/${this.encInstance}`,
        {
          number: phone,
          text: message,
          ...(options?.delay ? { delay: options.delay } : {}),
          ...(options?.linkPreview !== undefined ? { linkPreview: options.linkPreview } : {}),
        }
      );
      return { success: true, messageId: result.key?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string, options?: { delay?: number }): Promise<SendResult> {
    try {
      const result = await this.request<{ key?: { id: string } }>(
        "POST",
        `/message/sendMedia/${this.encInstance}`,
        {
          number: phone,
          media: fileUrl,
          caption: caption || "",
          ...(options?.delay ? { delay: options.delay } : {}),
        }
      );
      return { success: true, messageId: result.key?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async checkConnection(): Promise<DeviceStatus> {
    try {
      const result = await this.request<{ instance: { state: string } }>(
        "GET",
        `/instance/connectionState/${this.encInstance}`
      );
      const connected = result.instance.state === "open";
      return { status: connected };
    } catch {
      return { status: false };
    }
  }

  // TAMBAHIN: Method buat retry kalo kena 463
  async sendTextWithRetry(phone: string, message: string, maxRetries = 3): Promise<SendResult> {
    let lastError: string | undefined;
    
    for (let i = 0; i < maxRetries; i++) {
      const result = await this.sendText(phone, message, { delay: 1000 });
      if (result.success) return result;
      
      lastError = result.error;
      
      if (result.error?.includes("463") || result.error?.includes("timelock") || result.error?.includes("timelocked")) {
        const waitTime = 2000 * (i + 1);
        console.log(`[Evolution] Error 463, retry ${i + 1}/${maxRetries} after ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      break;
    }
    
    return { success: false, error: lastError };
  }
}