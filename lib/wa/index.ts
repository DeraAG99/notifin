import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { WaProvider, WaProviderType } from "./provider";
import { FonnteProvider } from "./fonnte-provider";
import { EvolutionProvider } from "./evolution-provider";
import { OpenWAProvider } from "./openwa-provider";

interface CachedEntry {
  provider: WaProvider | null;
  providerType: WaProviderType | null;
  at: number;
}

const cached = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 60_000;

async function getSetting(adminId: string, key: string): Promise<string | number | boolean | null> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(and(eq(settings.adminId, adminId), eq(settings.key, key)));
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

function makeFonnteProvider(token: string, rateLimit: number): WaProvider {
  return new FonnteProvider(token, rateLimit);
}

function makeEvolutionProvider(baseUrl: string, apiKey: string, instance: string): WaProvider {
  return new EvolutionProvider({ baseUrl, apiKey, instance });
}

function makeOpenWAProvider(baseUrl: string, apiKey: string, session: string): WaProvider {
  return new OpenWAProvider({ baseUrl, apiKey, session });
}

async function makeBaileysProvider(adminId: string): Promise<WaProvider> {
  const mod = await import("./baileys-provider");
  return new mod.BaileysProvider(adminId);
}

export function resetWaProvider(adminId?: string): void {
  if (adminId) {
    cached.delete(adminId);
  } else {
    cached.clear();
  }
}

export async function getWaProvider(adminId: string): Promise<WaProvider> {
  const providerType = ((await getSetting(adminId, "waProvider")) as WaProviderType) || "fonnte";
  const entry = cached.get(adminId);

  if (
    entry &&
    entry.provider &&
    entry.providerType === providerType &&
    Date.now() - entry.at < CACHE_TTL_MS
  ) {
    return entry.provider;
  }

  let provider: WaProvider;
  switch (providerType) {
    case "fonnte": {
      const token = (await getSetting(adminId, "fonnteToken")) as string | null;
      if (!token && !process.env.FONNTE_TOKEN) {
        throw new Error("Fonnte token is not configured");
      }
      const rateLimit = Number((await getSetting(adminId, "fonnteRateLimit")) || process.env.FONNTE_RATE_LIMIT || 100);
      provider = makeFonnteProvider(token || process.env.FONNTE_TOKEN!, rateLimit);
      break;
    }

    case "evolution": {
      const baseUrl = (await getSetting(adminId, "evolutionBaseUrl")) as string | null;
      const apiKey = (await getSetting(adminId, "evolutionApiKey")) as string | null;
      const instance = (await getSetting(adminId, "evolutionInstance")) as string | null;
      if (!baseUrl || !apiKey || !instance) {
        throw new Error("Evolution API is not fully configured (baseUrl, apiKey, instance required)");
      }
      provider = makeEvolutionProvider(baseUrl, apiKey, instance);
      break;
    }

    case "baileys": {
      provider = await makeBaileysProvider(adminId);
      break;
    }

    case "openwa": {
      const baseUrl = (await getSetting(adminId, "openwaBaseUrl")) as string | null;
      const apiKey = (await getSetting(adminId, "openwaApiKey")) as string | null;
      const session = (await getSetting(adminId, "openwaSession")) as string | null;
      if (!baseUrl || !apiKey || !session) {
        throw new Error("OpenWA is not fully configured (baseUrl, apiKey, session required)");
      }
      provider = makeOpenWAProvider(baseUrl, apiKey, session);
      break;
    }

    default:
      throw new Error(`Unknown WhatsApp provider: ${providerType}`);
  }

  cached.set(adminId, { provider, providerType, at: Date.now() });
  return provider;
}

export async function getWaHealth(adminId: string): Promise<boolean> {
  try {
    const providerType = ((await getSetting(adminId, "waProvider")) as WaProviderType) || "fonnte";

    if (providerType === "baileys") {
      const rows = await db
        .select()
        .from(settings)
        .where(and(eq(settings.adminId, adminId), eq(settings.key, "baileys_connected")));
      return rows.length > 0 && rows[0].value === true;
    }

    const provider = await getWaProvider(adminId).catch(() => null);
    if (!provider) return false;
    const status = await provider.checkConnection();
    return status.status;
  } catch {
    return false;
  }
}
