import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { WaProvider, WaProviderType } from "./provider";
import { FonnteProvider } from "./fonnte-provider";
import { EvolutionProvider } from "./evolution-provider";
import { OpenWAProvider } from "./openwa-provider";

let cachedProvider: WaProvider | null = null;
let cachedProviderType: WaProviderType | null = null;

async function getSetting(key: string): Promise<string | number | boolean | null> {
  try {
    const rows = await db.select().from(settings).where(eq(settings.key, key));
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

async function makeBaileysProvider(): Promise<WaProvider> {
  const mod = await import("./baileys-provider");
  return new mod.BaileysProvider();
}

export function resetWaProvider(): void {
  cachedProvider = null;
  cachedProviderType = null;
}

export async function getWaProvider(): Promise<WaProvider> {
  const providerType = ((await getSetting("waProvider")) as WaProviderType) || "fonnte";

  if (cachedProvider && cachedProviderType === providerType) {
    return cachedProvider;
  }

  switch (providerType) {
    case "fonnte": {
      const token = (await getSetting("fonnteToken")) as string | null;
      if (!token && !process.env.FONNTE_TOKEN) {
        throw new Error("Fonnte token is not configured");
      }
      const rateLimit = Number((await getSetting("fonnteRateLimit")) || process.env.FONNTE_RATE_LIMIT || 100);
      cachedProvider = makeFonnteProvider(token || process.env.FONNTE_TOKEN!, rateLimit);
      cachedProviderType = "fonnte";
      return cachedProvider;
    }

    case "evolution": {
      const baseUrl = (await getSetting("evolutionBaseUrl")) as string | null;
      const apiKey = (await getSetting("evolutionApiKey")) as string | null;
      const instance = (await getSetting("evolutionInstance")) as string | null;
      if (!baseUrl || !apiKey || !instance) {
        throw new Error("Evolution API is not fully configured (baseUrl, apiKey, instance required)");
      }
      cachedProvider = makeEvolutionProvider(baseUrl, apiKey, instance);
      cachedProviderType = "evolution";
      return cachedProvider;
    }

    case "baileys": {
      cachedProvider = await makeBaileysProvider();
      cachedProviderType = "baileys";
      return cachedProvider;
    }

    case "openwa": {
      const baseUrl = (await getSetting("openwaBaseUrl")) as string | null;
      const apiKey = (await getSetting("openwaApiKey")) as string | null;
      const session = (await getSetting("openwaSession")) as string | null;
      if (!baseUrl || !apiKey || !session) {
        throw new Error("OpenWA is not fully configured (baseUrl, apiKey, session required)");
      }
      cachedProvider = makeOpenWAProvider(baseUrl, apiKey, session);
      cachedProviderType = "openwa";
      return cachedProvider;
    }

    default:
      throw new Error(`Unknown WhatsApp provider: ${providerType}`);
  }
}

export async function getWaHealth(): Promise<boolean> {
  try {
    const providerType = ((await getSetting("waProvider")) as WaProviderType) || "fonnte";

    if (providerType === "baileys") {
      const rows = await db.select().from(settings).where(eq(settings.key, "baileys_connected"));
      return rows.length > 0 && rows[0].value === true;
    }

    const provider = await getWaProvider().catch(() => null);
    if (!provider) return false;
    const status = await provider.checkConnection();
    return status.status;
  } catch {
    return false;
  }
}
