import type { SendResult, WaProvider } from "./provider";
import type { DeviceStatus } from "@/types";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export class BaileysProvider implements WaProvider {
  readonly name = "baileys" as const;

  private adminId: string;
  private manager: import("./baileys-manager").BaileysManager | null = null;
  private initPromise: Promise<void> | null = null;
  private sendChain: Promise<void> = Promise.resolve();

  constructor(adminId: string) {
    this.adminId = adminId;
  }

  private async getDelayMs(): Promise<number> {
    const readSetting = async (key: string): Promise<number | null> => {
      try {
        const rows = await db
          .select()
          .from(settings)
          .where(and(eq(settings.adminId, this.adminId), eq(settings.key, key)));
        if (rows.length === 0) return null;
        const n = Number(rows[0].value);
        return Number.isFinite(n) && n >= 0 ? n : null;
      } catch {
        return null;
      }
    };

    const fromEnv = (raw: string | undefined, fallback: number): number => {
      const n = Number(raw);
      return raw && Number.isFinite(n) && n >= 0 ? n : fallback;
    };

    const min =
      (await readSetting("baileysMinDelayMs")) ??
      fromEnv(process.env.BAILEYS_MIN_DELAY_MS, 8000);
    const max =
      (await readSetting("baileysMaxDelayMs")) ??
      fromEnv(process.env.BAILEYS_MAX_DELAY_MS, 15000);

    return Math.max(min, 0) + Math.floor(Math.random() * (Math.max(max, min) - min + 1));
  }

  async ensureReady(): Promise<void> {
    if (this.manager) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.init();
    return this.initPromise;
  }

  private async init(): Promise<void> {
    const mod = await import("./baileys-manager");
    this.manager = mod.BaileysManager.getInstance(this.adminId);
    await this.manager.connect();
  }

  private async waitForRateLimit(): Promise<void> {
    const mod = await import("./baileys-manager");
    const now = Date.now();
    const delay = await this.getDelayMs();
    const elapsed = now - mod.BaileysManager.getLastSendTime(this.adminId);

    if (elapsed < delay) {
      const waitTime = delay - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    mod.BaileysManager.setLastSendTime(this.adminId, Date.now());
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.sendChain.then(task, task);
    this.sendChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async sendText(phone: string, message: string): Promise<SendResult> {
    return this.enqueue(async () => {
      try {
        await this.ensureReady();
        await this.waitForRateLimit();
        return await this.manager!.sendText(phone, message);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    });
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    return this.enqueue(async () => {
      try {
        await this.ensureReady();
        await this.waitForRateLimit();
        return await this.manager!.sendMedia(phone, fileUrl, caption);
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    });
  }

  async checkConnection(): Promise<DeviceStatus> {
    if (this.manager) {
      const connected = this.manager.isConnected();
      return { status: connected, data: { device: "Baileys", battery: "", platform: "web", connected } };
    }

    try {
      const rows = await db
        .select()
        .from(settings)
        .where(and(eq(settings.adminId, this.adminId), eq(settings.key, "baileys_connected")));
      const connected = rows.length > 0 && rows[0].value === true;
      return { status: connected, data: { device: "Baileys", battery: "", platform: "web", connected } };
    } catch {
      return { status: false };
    }
  }
}
