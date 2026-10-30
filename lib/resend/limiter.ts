import IORedis from "ioredis";

// Redis TIME avoids clock skew between web/worker hosts. Do not reserve future
// slots: every waiter must recheck the shared cooldown immediately before use.
export const RESEND_LIMIT_SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local nextAt = tonumber(redis.call('HGET', KEYS[1], 'nextAt')) or 0
local blockedUntil = tonumber(redis.call('HGET', KEYS[1], 'blockedUntil')) or 0
if ARGV[1] == 'cooldown' then
  blockedUntil = math.max(blockedUntil, now + tonumber(ARGV[2]))
  redis.call('HSET', KEYS[1], 'blockedUntil', blockedUntil)
else
  local wait = math.max(nextAt, blockedUntil) - now
  if wait > 0 then return wait end
  nextAt = now + tonumber(ARGV[2])
  redis.call('HSET', KEYS[1], 'nextAt', nextAt)
end
redis.call('PEXPIRE', KEYS[1], math.max(nextAt, blockedUntil) - now + 60000)
return 0
`;

export interface ResendGate {
  take(maxWaitMs?: number): Promise<void>;
  cooldown(ms: number): Promise<void>;
}

export class ResendGateWaitError extends Error {
  constructor(readonly retryAt: number) {
    super("Resend cooldown masih aktif; pengiriman ditunda");
  }
}

type RedisEval = Pick<IORedis, "eval">;
export class ResendLimiter implements ResendGate {
  constructor(
    private redis: RedisEval,
    private key = "notifin:resend:team-limiter",
    private intervalMs = 1000,
    private sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    private now = Date.now,
  ) {}

  async take(maxWaitMs = 30_000): Promise<void> {
    const deadline = this.now() + maxWaitMs;
    while (true) {
      const wait = Number(await this.redis.eval(RESEND_LIMIT_SCRIPT, 1, this.key, "take", this.intervalMs));
      if (!Number.isFinite(wait) || wait < 0) throw new Error("Invalid Resend limiter response");
      if (wait === 0) return;
      if (this.now() + wait > deadline) throw new ResendGateWaitError(this.now() + wait);
      await this.sleep(Math.max(1, wait));
    }
  }

  async cooldown(ms: number): Promise<void> {
    await this.redis.eval(RESEND_LIMIT_SCRIPT, 1, this.key, "cooldown", Math.max(1000, Math.ceil(ms)));
  }
}

let shared: ResendLimiter | null = null;
export function getResendLimiter(): ResendLimiter {
  if (!shared) {
    const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000,
      commandTimeout: 5000, retryStrategy: times => Math.min(times * 500, 5000),
    });
    redis.on("error", () => {});
    // Legacy values (2 RPS / burst 5) cannot accidentally re-enable bursts.
    const configured = Number(process.env.RESEND_RATE_LIMIT_RPS);
    const rps = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 1) : 1;
    shared = new ResendLimiter(redis, "notifin:resend:team-limiter", Math.ceil(1000 / rps));
  }
  return shared;
}
