import type { SendResult } from "./provider";

export class WaDeliveryError extends Error {
  constructor(message: string, readonly kind: NonNullable<SendResult["failureKind"]>) {
    super(message);
    this.name = "WaDeliveryError";
  }
}

export interface DeliveryStore {
  claim(): Promise<"claimed" | "sent" | "uncertain">;
  record(state: "ready" | "sent" | "uncertain" | "failed", error?: string, messageId?: string): Promise<void>;
}

/** Persist intent BEFORE submitting to WA. No exactly-once claim across WA/DB. */
export async function deliverBaileysOnce(store: DeliveryStore, send: () => Promise<SendResult>) {
  const claim = await store.claim();
  if (claim === "sent") return;
  if (claim === "uncertain") {
    throw new WaDeliveryError("Hasil pengiriman sebelumnya belum pasti; periksa WhatsApp sebelum mengirim ulang sebagai pengiriman baru.", "uncertain");
  }

  let result: SendResult;
  try { result = await send(); }
  catch {
    result = { success: false, failureKind: "uncertain", error: "Pengiriman terputus; hasil belum pasti" };
  }

  try {
    if (result.success) {
      await store.record("sent", undefined, result.messageId);
      return;
    }
    const kind = result.failureKind || "uncertain";
    await store.record(
      kind === "temporary" || kind === "disconnected" ? "ready" : kind === "permanent" ? "failed" : "uncertain",
      result.error || "WhatsApp send failed",
    );
  } catch {
    // The durable 'sending' marker remains if persistence fails: never resubmit.
    throw new WaDeliveryError("Gagal menyimpan hasil pengiriman; periksa WhatsApp sebelum mengirim ulang sebagai pengiriman baru.", "uncertain");
  }
  throw new WaDeliveryError(result.error || "WhatsApp send failed", result.failureKind || "uncertain");
}
