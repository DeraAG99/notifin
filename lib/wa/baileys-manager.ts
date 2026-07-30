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

async function writeDbSetting(key: string, value: string | number | boolean) {
  try {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  } catch {
    // silent
  }
}

export class BaileysManager {
  private static instance: BaileysManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sock: any = null;
  private _connected = false;
  private connecting = false;
  private latestQr: string | null = null;

  static getInstance(): BaileysManager {
    if (!BaileysManager.instance) {
      BaileysManager.instance = new BaileysManager();
    }
    return BaileysManager.instance;
  }

  isConnected(): boolean {
    return this._connected && this.sock !== null;
  }

  async connect(): Promise<void> {
    if (this._connected || this.connecting) return;
    this.connecting = true;

    const hasModule = await ensureBaileys();
    if (!hasModule) {
      await writeDbSetting("baileys_connected", false);
      this.connecting = false;
      return;
    }

    try {
      const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileysModule;

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

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
            await writeDbSetting("baileys_qr", base64);
          } catch {
            await writeDbSetting("baileys_qr", qr);
          }
        }

        if (connection === "close") {
          this._connected = false;
          writeDbSetting("baileys_connected", false);
          writeDbSetting("baileys_last_seen", new Date().toISOString());
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          if (shouldReconnect) {
            console.log("[Baileys] Connection closed, reconnecting...");
            setTimeout(() => this.connect(), 5000);
          }
        } else if (connection === "open") {
          this._connected = true;
          this.latestQr = null;
          writeDbSetting("baileys_connected", true);
          writeDbSetting("baileys_last_seen", new Date().toISOString());
          writeDbSetting("baileys_qr", "");
          console.log("[Baileys] Connected successfully");
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
      console.error("[Baileys] Failed to connect:", err);
      await writeDbSetting("baileys_connected", false);
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
    if (this.sock) {
      this.sock.close();
      this.sock = null;
    }
    this._connected = false;
    writeDbSetting("baileys_connected", false);
  }
}
