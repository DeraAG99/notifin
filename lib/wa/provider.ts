import type { DeviceStatus } from "@/types";

export type WaProviderType = "fonnte" | "evolution" | "baileys" | "openwa";

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WaProvider {
  readonly name: WaProviderType;
  sendText(phone: string, message: string): Promise<SendResult>;
  sendMedia(phone: string, fileUrl: string, caption?: string): Promise<SendResult>;
  checkConnection(): Promise<DeviceStatus>;
}
