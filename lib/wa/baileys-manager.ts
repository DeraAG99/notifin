import type { SendResult } from "./provider";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import path from "path";
import fs from "fs";
import { SessionLease } from "./session-lease";

const AUTH_DIR = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), ".baileys-auth");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let baileysModule: any = null;

async function ensureBaileys() {
  if (baileysModule) return true;
  try {
    baileysModule = await import("@whiskeysockets/baileys");
    return true;
  } catch {
    return false;
  }
}

async function writeDbSetting(adminId: string, key: string, value: string | number | boolean) {
  try {
    await db
      .insert(settings)
      .values({ adminId, key, value })
      .onConflictDoUpdate({
        target: [settings.adminId, settings.key],
        set: { value, updatedAt: new Date() },
      });
  } catch {
    // silent
  }
}

export async function setBaileysError(adminId: string, message: string | null): Promise<void> {
  await writeDbSetting(adminId, "baileys_error", message || "");
}

export async function clearBaileysSessionFlags(adminId: string): Promise<void> {
  await writeDbSetting(adminId, "baileys_connected", false);
  await writeDbSetting(adminId, "baileys_qr", "");
  await writeDbSetting(adminId, "baileys_last_seen", "");
}

export async function resetBaileysState(adminId: string): Promise<void> {
  await writeDbSetting(adminId, "baileys_connected", false);
  await writeDbSetting(adminId, "baileys_qr", "");
  await writeDbSetting(adminId, "baileys_phone", "");
  await writeDbSetting(adminId, "baileys_last_seen", "");
  await writeDbSetting(adminId, "baileys_error", "");
}

export class BaileysManager {
  private static instances = new Map<string, BaileysManager>();
  private adminId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sock: any = null;
  private _connected = false;
  private connecting = false;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private latestQr: string | null = null;
  private lease: SessionLease | null = null;
  private reconnectAttempts = 0;
  private needsReconnect = false;
  private requiresPairing = false;
  private failureCount = 0;
  private pausedUntil = 0;
  private authDir: string;
  /**
   * Serialisation chain for this session. Instance-level, not static: there is
   * exactly one manager per admin (`getInstance`, constructor is private), so an
   * instance field is already per-admin AND process-lifetime.
   */
  private sendChain: Promise<void> = Promise.resolve();

  private constructor(adminId: string) {
    this.adminId = adminId;
    this.authDir = path.join(AUTH_DIR, adminId);
  }

  static getInstance(adminId: string): BaileysManager {
    let instance = BaileysManager.instances.get(adminId);
    if (!instance) {
      instance = new BaileysManager(adminId);
      BaileysManager.instances.set(adminId, instance);
    }
    return instance;
  }

  static async disconnectAll(): Promise<void> {
    for (const instance of BaileysManager.instances.values()) {
      await instance.disconnect();
    }
  }

  static async disconnect(adminId: string): Promise<void> {
    const instance = BaileysManager.instances.get(adminId);
    if (instance) {
      await instance.disconnect();
      // Keep the stopped manager so a provider cache refresh cannot silently
      // reconnect a session that the operator deliberately disconnected.
      return;
    }
  }

  isConnected(): boolean {
    return this._connected && this.sock !== null;
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.requiresPairing || this.reconnectTimer) return;
    if (BaileysManager.instances.get(this.adminId) !== this) return;
    // A close during initial QR/pairing used to consume its timer while
    // connecting=true. The finally block schedules it once connect has settled.
    if (this.connecting) { this.needsReconnect = true; return; }
    const delay = Math.min(60_000, 2000 * 2 ** Math.min(this.reconnectAttempts++, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay + Math.floor(Math.random() * 1000));
  }

  private async closeSocket(): Promise<void> {
    const socket = this.sock;
    this.sock = null;
    this._connected = false;
    if (socket) {
      // Baileys v7 exposes end(), not close(). Never logout during a restart.
      try { await socket.end(new Error("Session stopped")); }
      catch { /* Socket may already be closed. */ }
    }
  }

  private static lastSendTimes = new Map<string, number>();

  static getLastSendTime(adminId: string): number {
    return BaileysManager.lastSendTimes.get(adminId) ?? 0;
  }

  static setLastSendTime(adminId: string, at: number): void {
    BaileysManager.lastSendTimes.set(adminId, at);
  }

  async connect(manual = false): Promise<void> {
    if (BaileysManager.instances.get(this.adminId) !== this) return;
    if (!manual && (this.requiresPairing || this.intentionalClose)) return;
    if (this._connected || this.connecting) return;
    this.connecting = true;
    this.intentionalClose = false;
    this.requiresPairing = false;
    this.needsReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const hasModule = await ensureBaileys();
    if (!hasModule) {
      await writeDbSetting(this.adminId, "baileys_connected", false);
      await setBaileysError(this.adminId, "Modul Baileys tidak tersedia di server");
      this.connecting = false;
      return;
    }

    try {
      if (!this.lease) {
        const lease = new SessionLease(`notifin:baileys:session:${this.adminId}`, () => {
          const closed = this.closeSocket();
          void writeDbSetting(this.adminId, "baileys_connected", false);
          void setBaileysError(this.adminId, "Kepemilikan session hilang; menunggu koneksi ulang");
          if (this.lease === lease) this.lease = null;
          void closed.finally(() => lease.release());
          this.scheduleReconnect();
        });
        if (!(await lease.acquire())) {
          console.warn(`[Baileys:${this.adminId}] Session owned elsewhere or Redis unavailable; waiting`);
          this.needsReconnect = true;
          return;
        }
        // A disconnect can arrive while Redis acquisition was pending.
        if (this.intentionalClose || BaileysManager.instances.get(this.adminId) !== this) {
          await lease.release();
          return;
        }
        this.lease = lease;
      }
      await clearBaileysSessionFlags(this.adminId);
      await setBaileysError(this.adminId, null);
      const { makeWASocket, useMultiFileAuthState: initialiseAuthState, DisconnectReason } = baileysModule;

      const { state, saveCreds } = await initialiseAuthState(this.authDir);

      if (this.intentionalClose) return;
      if (!this.lease || !(await this.lease.assertOwned())) {
        this.needsReconnect = true;
        return;
      }
      await this.closeSocket();
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        defaultQueryTimeoutMs: 30000,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
          trace: () => {},
          child: () => ({
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
            trace: () => {},
          }),
        },
      });
      this.sock = socket;

      socket.ev.on("creds.update", saveCreds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.ev.on("connection.update", async (update: any) => {
        if (this.sock !== socket) return;
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          this.latestQr = qr;
          try {
            const qrcode = await import("qrcode");
            const base64 = await qrcode.toDataURL(qr, { margin: 1, width: 300 });
            await writeDbSetting(this.adminId, "baileys_qr", base64);
          } catch {
            await writeDbSetting(this.adminId, "baileys_qr", qr);
          }
        }

        if (connection === "close") {
          this._connected = false;
          writeDbSetting(this.adminId, "baileys_connected", false);
          if (this.intentionalClose) {
            this.intentionalClose = false;
            console.log(`[Baileys:${this.adminId}] Disconnected intentionally, no reconnect`);
            return;
          }
          const isRegistered = BaileysManager.instances.get(this.adminId) === this;
          const statusCode = lastDisconnect?.error?.output?.statusCode;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log(`[Baileys:${this.adminId}] Session logged out by WhatsApp, resetting credentials...`);
            try {
              await fs.promises.rm(this.authDir, { recursive: true, force: true });
            } catch {
              // ignore
            }
            await resetBaileysState(this.adminId);
            this.requiresPairing = true;
            await setBaileysError(this.adminId, "Session logout; klik Hubungkan dan scan QR kembali");
            await this.closeSocket();
            const lease = this.lease;
            this.lease = null;
            await lease?.release();
            return;
          }

          if ([DisconnectReason.connectionReplaced, DisconnectReason.badSession, DisconnectReason.forbidden].includes(statusCode)) {
            this.requiresPairing = true;
            await this.closeSocket();
            await setBaileysError(this.adminId, `Session dihentikan (kode ${statusCode}); periksa WhatsApp lalu hubungkan ulang`);
            const lease = this.lease;
            this.lease = null;
            await lease?.release();
            return;
          }

          writeDbSetting(this.adminId, "baileys_last_seen", new Date().toISOString());
          if (isRegistered) {
            console.log(`[Baileys:${this.adminId}] Connection closed, reconnecting...`);
            this.scheduleReconnect();
          }
        } else if (connection === "open") {
          if (BaileysManager.instances.get(this.adminId) !== this) {
            console.log(`[Baileys:${this.adminId}] Orphan socket opened, closing`);
            try {
              await socket.end(new Error("Orphan socket"));
            } catch {
              // ignore
            }
            return;
          }
          this._connected = true;
          this.reconnectAttempts = 0;
          this.needsReconnect = false;
          this.latestQr = null;
          writeDbSetting(this.adminId, "baileys_connected", true);
          writeDbSetting(this.adminId, "baileys_last_seen", new Date().toISOString());
          writeDbSetting(this.adminId, "baileys_qr", "");
          setBaileysError(this.adminId, null);
          const rawJid = (this.sock?.user?.id as string | undefined) || "";
          const phone = rawJid.split(/[:@]/)[0].replace(/\D/g, "");
          if (phone) {
            writeDbSetting(this.adminId, "baileys_phone", phone);
          }
          console.log(`[Baileys:${this.adminId}] Connected successfully${phone ? ` as +${phone}` : ""}`);
        }
      });

      await new Promise<void>((resolve) => {
        const onConnection = (update: { connection?: string }) => {
          if (update.connection === "open" || update.connection === "close") {
            clearTimeout(timeout);
            socket.ev.off("connection.update", onConnection);
            resolve();
          }
        };
        const timeout = setTimeout(() => {
          socket.ev.off("connection.update", onConnection);
          resolve();
        }, 30000);
        socket.ev.on("connection.update", onConnection);
      });
    } catch (err) {
      console.error(`[Baileys:${this.adminId}] Failed to connect:`, err);
      await writeDbSetting(this.adminId, "baileys_connected", false);
      await setBaileysError(
        this.adminId,
        err instanceof Error ? err.message : "Gagal terhubung ke WhatsApp"
      );
      this.needsReconnect = true;
    } finally {
      this.connecting = false;
      if (this.needsReconnect) this.scheduleReconnect();
    }
  }

  /**
   * Serialise every send on this session.
   *
   * Lives on the manager rather than on `BaileysProvider` because those two have
   * completely different lifetimes. The provider is rebuilt whenever
   * `getWaProvider`'s 60s cache lapses; this socket lives for the whole process.
   * A chain held on the provider therefore stopped serialising part-way through a
   * burst, and because the WA worker runs with concurrency 10, a cold cache let
   * all ten first-wave jobs build their own provider -- so ten chains each read
   * `lastSendTime` as 0, none of them waited, and ten messages went out at once.
   *
   * `.then(task, task)` rather than `.then(task)`: a rejected task must not
   * poison the chain for every send queued behind it.
   */
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.sendChain.then(task, task);
    this.sendChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async sendText(phone: string, message: string): Promise<SendResult> {
    const unavailable = await this.checkSendReady();
    if (unavailable) return unavailable;
    const digits = phone.replace(/[^0-9]/g, "");
    if (!/^[1-9]\d{9,14}$/.test(digits)) {
      return { success: false, failureKind: "permanent", error: "Nomor WhatsApp harus memakai kode negara (10–15 digit)" };
    }

    try {
      const jid = `${digits}@s.whatsapp.net`;
      const result = await this.sock.sendMessage(jid, { text: message });
      if (!result?.key?.id) throw new Error("WhatsApp tidak mengembalikan message ID");
      this.failureCount = 0;
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return this.uncertainSend(err);
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    const unavailable = await this.checkSendReady();
    if (unavailable) return unavailable;
    const digits = phone.replace(/[^0-9]/g, "");
    if (!/^[1-9]\d{9,14}$/.test(digits)) {
      return { success: false, failureKind: "permanent", error: "Nomor WhatsApp harus memakai kode negara (10–15 digit)" };
    }

    let buffer: ArrayBuffer;
    try {
      const response = await fetch(fileUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) return {
        success: false, failureKind: response.status >= 500 || response.status === 429 ? "temporary" : "permanent",
        error: `Media download failed: HTTP ${response.status}`,
      };
      buffer = await response.arrayBuffer();
    } catch (err) {
      return { success: false, failureKind: "temporary", error: err instanceof Error ? err.message : "Media download failed" };
    }
    const recheck = await this.checkSendReady();
    if (recheck) return recheck;
    try {
      const jid = `${digits}@s.whatsapp.net`;
      const result = await this.sock.sendMessage(jid, {
        image: Buffer.from(buffer),
        caption: caption || "",
      });
      if (!result?.key?.id) throw new Error("WhatsApp tidak mengembalikan message ID");
      this.failureCount = 0;
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return this.uncertainSend(err);
    }
  }

  private async checkSendReady(): Promise<SendResult | null> {
    if (Date.now() < this.pausedUntil) {
      return { success: false, failureKind: "disconnected", error: "Pengiriman dijeda sementara setelah kegagalan beruntun" };
    }
    if (!this.sock || !this._connected || !this.lease || !(await this.lease.assertOwned())) {
      return { success: false, failureKind: "disconnected", error: "Baileys belum terhubung atau session tidak dimiliki worker ini" };
    }
    return null;
  }

  private uncertainSend(err: unknown): SendResult {
    if (++this.failureCount >= 3) {
      this.pausedUntil = Date.now() + 60_000;
      this.failureCount = 0;
      void setBaileysError(this.adminId, "Pengiriman dijeda 60 detik setelah kegagalan beruntun");
    }
    return {
      success: false, failureKind: "uncertain",
      error: `Hasil kirim belum pasti: ${err instanceof Error ? err.message : "Unknown error"}. Periksa WhatsApp sebelum kirim ulang.`,
    };
  }

  getQr(): string | null {
    return this.latestQr;
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.requiresPairing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.closeSocket();
    const lease = this.lease;
    this.lease = null;
    await lease?.release();
    this._connected = false;
    if (lease) await resetBaileysState(this.adminId);
  }
}
