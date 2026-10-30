import { describe, expect, test } from "bun:test";
import { ResendLimiter, ResendGateWaitError, type ResendGate } from "../lib/resend/limiter";
import { nextUtcDay, retryAfterMs, submitResend, ResendWindowExpiredError } from "../lib/resend/client";
import { resendRetryDecision } from "../lib/resend/retry";
import { deliverResend, type ResendDeliveryStore } from "../lib/resend/delivery";

const gate = (): ResendGate & { admissions: number; waits: number[] } => ({
  admissions: 0, waits: [],
  async take() { this.admissions++; },
  async cooldown(ms) { this.waits.push(ms); },
});
const response = (status: number, data: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers });
const http = (handler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>) => handler as typeof fetch;

describe("Resend HTTP client (fake network only)", () => {
  test("Retry-After never shortens the required delay", () => {
    const now = Date.UTC(2026, 9, 30);
    expect(retryAfterMs("60", now)).toBe(60_000);
    expect(retryAfterMs(new Date(now + 90_000).toUTCString(), now)).toBe(90_000);
    expect(retryAfterMs("broken", now)).toBe(5000);
    expect(retryAfterMs("0", now)).toBe(5000);
  });

  test("429 publishes shared cooldown and does not perform an internal retry", async () => {
    const shared = gate();
    let calls = 0;
    const result = await submitResend({}, "same-log", "test-key", shared, undefined, http(async () => {
      calls++;
      return response(429, { name: "rate_limit_exceeded", message: "10 requests per second" }, { "Retry-After": "60" });
    }), () => 1000);
    expect(calls).toBe(1);
    expect(shared.admissions).toBe(1);
    expect(shared.waits).toEqual([60_000]);
    expect(result.failureKind).toBe("rate_limit");
    expect(result.retryAt).toBe(61_000);
  });

  test("daily and monthly quotas are not mistaken for a short rate-limit wait", async () => {
    const now = Date.UTC(2026, 9, 30, 12);
    for (const name of ["daily_quota_exceeded", "monthly_quota_exceeded"]) {
      const shared = gate();
      const result = await submitResend({}, "log", "test", shared, undefined,
        http(async () => response(429, { name })), () => now);
      expect(result.failureKind).toBe(name.startsWith("daily") ? "daily_quota" : "monthly_quota");
      expect(shared.waits[0]).toBeGreaterThanOrEqual(3600_000);
      if (name.startsWith("daily")) expect(result.retryAt).toBe(nextUtcDay(now) + 1000);
    }
  });

  test("same key and exact payload are reused after an ambiguous timeout", async () => {
    const requests: { key: string; body: string }[] = [];
    const body = { from: "Sender <sender@example.com>", to: ["user@example.com"], subject: "eTPP", html: "<p>Frozen</p>" };
    let calls = 0;
    const network = http(async (_url, init) => {
      requests.push({ key: new Headers(init?.headers).get("Idempotency-Key")!, body: String(init?.body) });
      if (++calls === 1) throw new Error("Response lost after server accepted email");
      return response(200, { id: "same-resend-email" });
    });
    expect((await submitResend(body, "notification/log-1", "test", gate(), undefined, network)).failureKind).toBe("uncertain");
    expect((await submitResend(body, "notification/log-1", "test", gate(), undefined, network)).id).toBe("same-resend-email");
    expect(requests[0]).toEqual(requests[1]);
  });

  test("Redis outage and DB preflight failure do not make HTTP requests", async () => {
    let calls = 0;
    const network = http(async () => { calls++; return response(200, { id: "never" }); });
    const offline = gate();
    offline.take = async () => { throw new Error("Redis unavailable"); };
    expect((await submitResend({}, "log", "test", offline, undefined, network)).failureKind).toBe("temporary");
    expect((await submitResend({}, "log", "test", gate(), async () => { throw new Error("DB unavailable"); }, network)).failureKind).toBe("temporary");
    expect(calls).toBe(0);
  });

  test("shared long cooldown defers without submitting or consuming a send retry", async () => {
    const shared = gate();
    shared.take = async () => { throw new ResendGateWaitError(90_000); };
    let intentWrites = 0;
    const result = await submitResend({}, "log", "test", shared, async () => { intentWrites++; });
    expect(result.failureKind).toBe("rate_limit");
    expect(intentWrites).toBe(1); // Persist intent before waiting; no API request was made.
  });

  test("a fresh unsent intent can be cleared after cooldown or a definitive 429", async () => {
    for (const blocked of [true, false]) {
      const shared = gate();
      if (blocked) shared.take = async () => { throw new ResendGateWaitError(90_000); };
      let undos = 0;
      const result = await submitResend({}, "log", "test", shared,
        async () => async () => { undos++; },
        http(async () => response(429, { name: "daily_quota_exceeded" })));
      expect(result.success).toBe(false);
      expect(undos).toBe(1);
    }
  });

  test("ambiguous submissions retain their intent even if no response ID is available", async () => {
    for (const serverError of [true, false]) {
      let undos = 0;
      const result = await submitResend({}, "log", "test", gate(),
        async () => async () => { undos++; }, http(async () => {
          if (serverError) return response(503, {});
          throw new Error("response lost");
        }));
      expect(result.success).toBe(false);
      expect(undos).toBe(0);
    }
  });

  test("idempotency concurrency responses cannot clear a possibly in-flight request", async () => {
    let undos = 0;
    const result = await submitResend({}, "log", "test", gate(),
      async () => async () => { undos++; },
      http(async () => response(409, { name: "concurrent_idempotent_requests" })));
    expect(result.failureKind).toBe("temporary");
    expect(undos).toBe(0);
  });

  test("an expired retry window blocks HTTP submission", async () => {
    let calls = 0;
    const result = await submitResend({}, "old-log", "test", gate(), async () => {
      throw new ResendWindowExpiredError("Check dashboard before resending");
    }, http(async () => { calls++; return response(200, { id: "never" }); }));
    expect(result.failureKind).toBe("permanent");
    expect(calls).toBe(0);
  });

  test("permanent rejection, concurrent key, server error and malformed success are classified", async () => {
    for (const [status, data, expected] of [
      [401, { message: "invalid key" }, "permanent"],
      [422, { message: "invalid address" }, "permanent"],
      [409, { name: "invalid_idempotent_request" }, "permanent"],
      [409, { name: "concurrent_idempotent_requests" }, "temporary"],
      [503, {}, "temporary"],
      [200, null, "uncertain"],
    ] as const) {
      const result = await submitResend({}, "log", "test", gate(), undefined, http(async () => response(status, data)));
      expect(result.failureKind).toBe(expected);
    }
  });
});

describe("Resend durable delivery orchestration", () => {
  test("a legacy log with an accepted email ID repairs its status without submitting", async () => {
    let repaired = false;
    let requests = 0;
    const result = await deliverResend({}, "legacy-log", "test", gate(), {
      async prepare() { return { body: {}, sent: true, messageId: "legacy-accepted-id" }; },
      async markAttempt() { throw new Error("Must not submit again"); },
      async record(state, _error, id) { repaired = state === "sent" && id === "legacy-accepted-id"; },
    }, http(async () => { requests++; return response(200, {}); }));
    expect(result.success).toBe(true);
    expect(repaired).toBe(true);
    expect(requests).toBe(0);
  });

  function journal() {
    let snapshot: Record<string, unknown> | null = null;
    let sent = false;
    let messageId = "";
    let failNextWrite = false;
    const store: ResendDeliveryStore = {
      async prepare(body) {
        snapshot ??= structuredClone(body);
        return { body: snapshot, sent, messageId };
      },
      async markAttempt() {},
      async record(state, _error, id) {
        if (failNextWrite) { failNextWrite = false; throw new Error("DB write failed after API acceptance"); }
        if (state === "sent") { sent = true; messageId = id || ""; }
      },
    };
    return { store, failWrite: () => { failNextWrite = true; } };
  }

  test("API success then DB failure then restart uses the same frozen payload and key", async () => {
    const log = journal();
    const accepted = new Map<string, { body: string; id: string }>();
    let requests = 0;
    const network = http(async (_url, init) => {
      requests++;
      const key = new Headers(init?.headers).get("Idempotency-Key")!;
      const previous = accepted.get(key);
      if (previous) {
        expect(String(init?.body)).toBe(previous.body);
        return response(200, { id: previous.id });
      }
      const email = { body: String(init?.body), id: `email-${accepted.size + 1}` };
      accepted.set(key, email);
      return response(200, { id: email.id });
    });
    log.failWrite();
    expect((await deliverResend({ subject: "Original eTPP", from: "original@example.com" }, "log-1", "test", gate(), log.store, network)).failureKind).toBe("temporary");
    // New process/settings/rendered content: the persisted snapshot still wins.
    expect((await deliverResend({ subject: "Changed", from: "changed@example.com" }, "log-1", "test", gate(), log.store, network)).success).toBe(true);
    expect((await deliverResend({ subject: "Changed again" }, "log-1", "test", gate(), log.store, network)).success).toBe(true);
    expect(requests).toBe(2);
    expect(accepted.size).toBe(1);
    // A deliberate new delivery log remains allowed for the same recipient.
    await deliverResend({ subject: "Next period" }, "log-2", "test", gate(), journal().store, network);
    expect(accepted.size).toBe(2);
  });

  test("failure to persist the frozen payload prevents any network submission", async () => {
    const log = journal();
    log.store.prepare = async () => { throw new Error("DB unavailable"); };
    let requests = 0;
    const result = await deliverResend({}, "log", "test", gate(), log.store, http(async () => {
      requests++;
      return response(200, { id: "never" });
    }));
    expect(result.failureKind).toBe("temporary");
    expect(requests).toBe(0);
  });
});

describe("Resend queue retry policy", () => {
  const failure = (kind: "rate_limit" | "temporary" | "uncertain" | "permanent" | "monthly_quota", retryAt?: number) => ({
    provider: "resend" as const, id: "", success: false, failureKind: kind, retryAt,
  });
  test("rate-limit deferrals preserve send-attempt budget and obey Retry-After", () => {
    expect(resendRetryDecision(failure("rate_limit", 60_000), { failures: 2 }, 1000)).toEqual({
      action: "delay", retryAt: 60_000, state: { failures: 2, deferrals: 1 },
    });
  });
  test("temporary and ambiguous outcomes get bounded exponential retry", () => {
    for (const kind of ["temporary", "uncertain"] as const) {
      expect(resendRetryDecision(failure(kind), {}, 1000)).toMatchObject({ action: "delay", retryAt: 6000, state: { failures: 1 } });
      expect(resendRetryDecision(failure(kind), { failures: 1 }, 1000)).toMatchObject({ action: "delay", retryAt: 11_000 });
      expect(resendRetryDecision(failure(kind), { failures: 2 }, 1000).action).toBe("fail");
    }
  });
  test("permanent errors, monthly quota and repeated 429s do not loop forever", () => {
    expect(resendRetryDecision(failure("permanent"), {}).action).toBe("fail");
    expect(resendRetryDecision(failure("monthly_quota"), {}).action).toBe("fail");
    expect(resendRetryDecision(failure("rate_limit"), { deferrals: 120 }).action).toBe("fail");
  });
});

// A fake Redis clock/atomic script adapter. No production Redis keys are touched.
function virtualRedis() {
  let time = 0;
  let nextAt = 0;
  let blockedUntil = 0;
  const sleepers: { at: number; resolve: () => void }[] = [];
  const redis = {
    async eval(_script: string, _count: number, _key: string, op: string, ms: number) {
      if (op === "cooldown") { blockedUntil = Math.max(blockedUntil, time + ms); return 0; }
      const wait = Math.max(nextAt, blockedUntil) - time;
      if (wait > 0) return wait;
      nextAt = time + ms;
      return 0;
    },
  } as unknown as ConstructorParameters<typeof ResendLimiter>[0];
  const limiter = () => new ResendLimiter(redis, "test-team", 1000,
    ms => new Promise<void>(resolve => sleepers.push({ at: time + ms, resolve })), () => time);
  async function run<T>(work: Promise<T>): Promise<T> {
    let done = false;
    void work.finally(() => { done = true; });
    for (let step = 0; !done && step < 100_000; step++) {
      // Let all current promise continuations settle before advancing the clock.
      for (let tick = 0; tick < 20; tick++) await Promise.resolve();
      if (sleepers.length && !done) {
        time = Math.min(...sleepers.map(s => s.at));
        const due = sleepers.filter(s => s.at <= time);
        for (const sleeper of due) { sleepers.splice(sleepers.indexOf(sleeper), 1); sleeper.resolve(); }
      }
    }
    if (!done) throw new Error("Virtual scheduler did not settle");
    return work;
  }
  return { limiter, run, now: () => time };
}

describe("shared Redis admission (virtual clock)", () => {
  test("100 admissions across web/workers and a fresh process never burst", async () => {
    const server = virtualRedis();
    const starts: number[] = [];
    await server.run(Promise.all(Array.from({ length: 100 }, async () => {
      // Each new instance represents a different process sharing the same key.
      await server.limiter().take(200_000);
      starts.push(server.now());
    })));
    expect(starts).toHaveLength(100);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(1000);
    expect(starts[99]).toBeGreaterThanOrEqual(99_000);
    await server.run(server.limiter().take());
    expect(server.now()).toBeGreaterThanOrEqual(100_000);
  });

  test("a later cooldown also delays waiters that were already queued", async () => {
    const server = virtualRedis();
    const first = server.limiter();
    await first.take();
    const waiting = server.limiter().take(120_000);
    await first.cooldown(60_000);
    await server.run(waiting);
    expect(server.now()).toBeGreaterThanOrEqual(60_000);
  });

  test("a short cooldown cannot shorten an existing longer cooldown", async () => {
    const server = virtualRedis();
    await server.limiter().cooldown(60_000);
    await server.limiter().cooldown(5000);
    await server.run(server.limiter().take(120_000));
    expect(server.now()).toBeGreaterThanOrEqual(60_000);
  });
});
