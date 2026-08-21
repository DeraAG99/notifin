import type { SendResult } from "./provider";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import path from "path";

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
  private authDir: string;

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

  static disconnectAll(): void {
    for (const instance of BaileysManager.instances.values()) {
      instance.disconnect();
    }
  }

  static disconnect(adminId: string): void {
    const instance = BaileysManager.instances.get(adminId);
    if (instance) {
      instance.disconnect();
      BaileysManager.instances.delete(adminId);
      return;
    }
    void resetBaileysState(adminId);
  }

  isConnected(): boolean {
    return this._connected && this.sock !== null;
  }

  async connect(): Promise<void> {
    if (BaileysManager.instances.get(this.adminId) !== this) return;
    if (this._connected || this.connecting) return;
    this.connecting = true;
    this.intentionalClose = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    writeDbSetting(this.adminId, "baileys_qr", "");
    setBaileysError(this.adminId, null);

    const hasModule = await ensureBaileys();
    if (!hasModule) {
      await writeDbSetting(this.adminId, "baileys_connected", false);
      await setBaileysError(this.adminId, "Modul Baileys tidak tersedia di server");
      this.connecting = false;
      return;
    }

    try {
      const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileysModule;

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
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

      this.sock.ev.on("creds.update", saveCreds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.sock.ev.on("connection.update", async (update: any) => {
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
          writeDbSetting(this.adminId, "baileys_last_seen", new Date().toISOString());
          const isRegistered = BaileysManager.instances.get(this.adminId) === this;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect =
            isRegistered && statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) {
            console.log(`[Baileys:${this.adminId}] Connection closed, reconnecting...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect();
            }, 5000);
          }
        } else if (connection === "open") {
          if (BaileysManager.instances.get(this.adminId) !== this) {
            console.log(`[Baileys:${this.adminId}] Orphan socket opened, closing`);
            try {
              this.sock?.close();
            } catch {
              // ignore
            }
            return;
          }
          this._connected = true;
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
        const timeout = setTimeout(() => resolve(), 30000);
        this.sock.ev.on("connection.update", (update: { connection?: string }) => {
          if (update.connection === "open") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    } catch (err) {
      console.error(`[Baileys:${this.adminId}] Failed to connect:`, err);
      await writeDbSetting(this.adminId, "baileys_connected", false);
      await setBaileysError(
        this.adminId,
        err instanceof Error ? err.message : "Gagal terhubung ke WhatsApp"
      );
    } finally {
      this.connecting = false;
    }
  }

  async sendText(phone: string, message: string): Promise<SendResult> {
    if (!this.sock || !this._connected) {
      return { success: false, error: "Baileys not connected" };
    }

    try {
      const jid = `${phone.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      const result = await this.sock.sendMessage(jid, { text: message });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  async sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult> {
    if (!this.sock || !this._connected) {
      return { success: false, error: "Baileys not connected" };
    }

    try {
      const jid = `${phone.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      const result = await this.sock.sendMessage(jid, {
        image: Buffer.from(buffer),
        caption: caption || "",
      });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  getQr(): string | null {
    return this.latestQr;
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        this.sock.close();
      } catch {
        // socket may already be closed
      }
      this.sock = null;
    }
    this._connected = false;
    void resetBaileysState(this.adminId);
  }
}
