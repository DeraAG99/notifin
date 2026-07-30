import type { SendResult, WaProvider } from "./provider";
import type { DeviceStatus } from "@/types";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const MIN_DELAY_MS = 2500;
const MAX_DELAY_MS = 5000;

export class BaileysProvider implements WaProvider {
  readonly name = "baileys" as const;

  private manager: import("./baileys-manager").BaileysManager | null = null;
  private initPromise: Promise<void> | null = null;
  private lastSendTime = 0;

  async ensureReady(): Promise<void> {
    if (this.manager) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<void> {
    const mod = await import("./baileys-manager");
    this.manager = mod.BaileysManager.getInstance();
    await this.manager.connect();
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastSendTime;
    const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;

    if (elapsed < delay) {
      const waitTime = delay - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastSendTime = Date.now();
  }

  async sendText(phone: string, message: string): Promise<SendResult> {
    try {
      await this.ensureReady();
      await this.waitForRateLimit();
      return await this.manager!.sendText(phone, message);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    try {
      await this.ensureReady();
      await this.waitForRateLimit();
      return await this.manager!.sendMedia(phone, fileUrl, caption);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async checkConnection(): Promise<DeviceStatus> {
    if (this.manager) {
      const connected = this.manager.isConnected();
      return { status: connected, data: { device: "Baileys", battery: "", platform: "web", connected } };
    }

    try {
      const rows = await db.select().from(settings).where(eq(settings.key, "baileys_connected"));
      const connected = rows.length > 0 && rows[0].value === true;
      return { status: connected, data: { device: "Baileys", battery: "", platform: "web", connected } };
    } catch {
      return { status: false };
    }
  }
}
