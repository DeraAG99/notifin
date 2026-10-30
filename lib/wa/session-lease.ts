import IORedis from "ioredis";
import { randomUUID } from "node:crypto";

const TTL_MS = 60_000;
const RENEW_MS = 15_000;
const OWNED = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
type LeaseRedis = Pick<IORedis, "on" | "set" | "get" | "eval" | "disconnect">;

/** One socket owner per admin across processes. Redis failures are fail-closed. */
export class SessionLease {
  private redis: LeaseRedis;
  private token = randomUUID();
  private timer: ReturnType<typeof setInterval> | null = null;
  private expiresAt = 0;
  private renewing = false;
  private stopped = false;

  constructor(private key: string, private onLost: () => void, redis?: LeaseRedis) {
    this.redis = redis || new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000,
      commandTimeout: 5000, retryStrategy: () => null,
    });
    this.redis.on("error", () => {});
  }

  async acquire(): Promise<boolean> {
    const started = Date.now();
    try {
      const acquired = await this.redis.set(this.key, this.token, "PX", TTL_MS, "NX");
      if (acquired !== "OK") { this.redis.disconnect(); return false; }
      this.expiresAt = started + TTL_MS;
      this.timer = setInterval(() => { void this.renew(); }, RENEW_MS);
      this.timer.unref();
      return true;
    } catch {
      this.redis.disconnect();
      return false;
    }
  }

  private async renew() {
    if (this.renewing || this.stopped) return;
    this.renewing = true;
    const started = Date.now();
    try {
      const renewed = await this.redis.eval(OWNED, 1, this.key, this.token, TTL_MS);
      if (renewed !== 1) throw new Error("Session lease lost");
      this.expiresAt = started + TTL_MS;
    } catch {
      this.expiresAt = 0;
      if (!this.stopped) {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        this.onLost();
      }
    } finally { this.renewing = false; }
  }

  async assertOwned(): Promise<boolean> {
    if (this.stopped || Date.now() >= this.expiresAt) return false;
    try {
      return await this.redis.get(this.key) === this.token && Date.now() < this.expiresAt;
    } catch { return false; }
  }

  async release() {
    this.stopped = true;
    this.expiresAt = 0;
    if (this.timer) clearInterval(this.timer);
    try { await this.redis.eval(RELEASE, 1, this.key, this.token); }
    catch { /* Let the TTL expire if Redis is unavailable. */ }
    finally { this.redis.disconnect(); }
  }
}
