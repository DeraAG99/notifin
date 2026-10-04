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

  /**
   * The session to send on. Resolved before entering the send chain, because the
   * chain lives on the manager and the manager has to exist to reach it.
   *
   * Return type is inferred on purpose: naming it would need a top-level import
   * of `./baileys-manager`, and the dynamic `import()` above exists precisely to
   * keep that module off the initial load path.
   */
  private async getManager() {
    await this.ensureReady();
    const manager = this.manager;
    if (!manager) throw new Error("Baileys provider not initialised");
    return manager;
  }

  /**
   * The zone to actually pace with, and the one piece of state that must not be
   * duplicated: `BaileysManager` owns both the send chain and `lastSendTime` for
   * the life of the process, so however many providers get built, every send on
   * this admin's socket is still serialised against every other one.
   */
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

  async sendText(phone: string, message: string): Promise<SendResult> {
    try {
      const manager = await this.getManager();
      return await manager.enqueue(async () => {
        await this.waitForRateLimit();
        return manager.sendText(phone, message);
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    try {
      const manager = await this.getManager();
      return await manager.enqueue(async () => {
        await this.waitForRateLimit();
        return manager.sendMedia(phone, fileUrl, caption);
      });
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
