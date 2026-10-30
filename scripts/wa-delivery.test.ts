import { describe, expect, test } from "bun:test";
import { deliverBaileysOnce, WaDeliveryError, type DeliveryStore } from "../lib/wa/delivery";
import { SessionLease } from "../lib/wa/session-lease";

function memoryStore() {
  let state = "ready";
  let failWrite = false;
  const store: DeliveryStore = {
    async claim() {
      if (state === "sent") return "sent";
      if (state !== "ready") return "uncertain";
      state = "sending";
      return "claimed";
    },
    async record(next) {
      if (failWrite) throw new Error("DB unavailable");
      state = next;
    },
  };
  return { store, state: () => state, failWrite: () => { failWrite = true; } };
}

describe("Baileys delivery guard (no live WhatsApp or database)", () => {
  test("100 recipients each send once; reprocessing the same logs does not send again", async () => {
    const logs = Array.from({ length: 100 }, memoryStore);
    let sends = 0;
    const send = async () => ({ success: true, messageId: `wa-${++sends}` });
    await Promise.all(logs.map(({ store }) => deliverBaileysOnce(store, send)));
    await Promise.all(logs.map(({ store }) => deliverBaileysOnce(store, send)));
    expect(sends).toBe(100);
    expect(logs.every(log => log.state() === "sent")).toBe(true);
  });

  test("a deliberate new log for the same recipient can send again", async () => {
    let sends = 0;
    const send = async () => ({ success: true, messageId: `${++sends}` });
    await deliverBaileysOnce(memoryStore().store, send);
    await deliverBaileysOnce(memoryStore().store, send);
    expect(sends).toBe(2);
  });

  test("concurrent processors for the same log submit only once", async () => {
    const { store } = memoryStore();
    let sends = 0;
    const results = await Promise.allSettled(Array.from({ length: 10 }, () =>
      deliverBaileysOnce(store, async () => ({ success: true, messageId: `${++sends}` })),
    ));
    expect(sends).toBe(1);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });

  test("successful WA submission followed by DB failure cannot cause a resend", async () => {
    const log = memoryStore();
    let sends = 0;
    const send = async () => {
      sends++;
      log.failWrite();
      return { success: true, messageId: "accepted" };
    };
    await expect(deliverBaileysOnce(log.store, send)).rejects.toMatchObject({ kind: "uncertain" });
    expect(log.state()).toBe("sending");
    await expect(deliverBaileysOnce(log.store, send)).rejects.toBeInstanceOf(WaDeliveryError);
    expect(sends).toBe(1);
  });

  test("worker restart with a durable sending marker never resubmits", async () => {
    const log = memoryStore();
    await log.store.claim(); // Previous process died after claiming.
    let sends = 0;
    await expect(deliverBaileysOnce(log.store, async () => {
      sends++;
      return { success: true };
    })).rejects.toMatchObject({ kind: "uncertain" });
    expect(sends).toBe(0);
  });

  test("disconnection before submission can safely resume", async () => {
    const log = memoryStore();
    await expect(deliverBaileysOnce(log.store, async () => ({
      success: false, failureKind: "disconnected", error: "offline",
    }))).rejects.toMatchObject({ kind: "disconnected" });
    expect(log.state()).toBe("ready");
    await deliverBaileysOnce(log.store, async () => ({ success: true, messageId: "recovered" }));
    expect(log.state()).toBe("sent");
  });

  test("confirmed temporary pre-send failure remains retryable", async () => {
    const log = memoryStore();
    await expect(deliverBaileysOnce(log.store, async () => ({
      success: false, failureKind: "temporary", error: "pre-send failure",
    }))).rejects.toMatchObject({ kind: "temporary" });
    expect(log.state()).toBe("ready");
  });

  test("permanent and unknown outcomes are not automatically resent", async () => {
    for (const kind of ["permanent", "uncertain"] as const) {
      const log = memoryStore();
      let sends = 0;
      const send = async () => { sends++; return { success: false, failureKind: kind }; };
      await expect(deliverBaileysOnce(log.store, send)).rejects.toMatchObject({ kind });
      await expect(deliverBaileysOnce(log.store, send)).rejects.toBeInstanceOf(WaDeliveryError);
      expect(sends).toBe(1);
    }
  });

  test("unexpected send exceptions are conservatively treated as uncertain", async () => {
    const log = memoryStore();
    await expect(deliverBaileysOnce(log.store, async () => { throw new Error("timeout"); }))
      .rejects.toMatchObject({ kind: "uncertain" });
    expect(log.state()).toBe("uncertain");
  });
});

describe("distributed session lease", () => {
  function redisServer() {
    const keys = new Map<string, string>();
    let offline = false;
    const client = () => ({
      on() {}, disconnect() {},
      async set(key: string, value: string) {
        if (offline) throw new Error("offline");
        if (keys.has(key)) return null;
        keys.set(key, value);
        return "OK";
      },
      async get(key: string) { if (offline) throw new Error("offline"); return keys.get(key) || null; },
      async eval(script: string, _count: number, key: string, token: string) {
        if (offline) throw new Error("offline");
        if (keys.get(key) !== token) return 0;
        if (script.includes("'del'")) keys.delete(key);
        return 1;
      },
    }) as unknown as NonNullable<ConstructorParameters<typeof SessionLease>[2]>;
    return { client, keys, goOffline: () => { offline = true; } };
  }

  test("two workers cannot own the same session; graceful shutdown allows takeover", async () => {
    const server = redisServer();
    const first = new SessionLease("admin-1", () => {}, server.client());
    const second = new SessionLease("admin-1", () => {}, server.client());
    const replacement = new SessionLease("admin-1", () => {}, server.client());
    try {
      expect(await first.acquire()).toBe(true);
      expect(await second.acquire()).toBe(false);
      expect(await first.assertOwned()).toBe(true);
      await first.release();
      expect(await replacement.acquire()).toBe(true);
    } finally { await first.release(); await second.release(); await replacement.release(); }
  });

  test("an old owner cannot delete the new owner's lock", async () => {
    const server = redisServer();
    const old = new SessionLease("admin-2", () => {}, server.client());
    await old.acquire();
    server.keys.set("admin-2", "new-owner-token");
    expect(await old.assertOwned()).toBe(false);
    await old.release();
    expect(server.keys.get("admin-2")).toBe("new-owner-token");
  });

  test("Redis outage fails closed rather than allowing an unowned send", async () => {
    const server = redisServer();
    const lease = new SessionLease("admin-3", () => {}, server.client());
    await lease.acquire();
    server.goOffline();
    expect(await lease.assertOwned()).toBe(false);
    await lease.release();
  });

  test("lease renewal loss notifies the owner to close its socket", async () => {
    const server = redisServer();
    let lost = 0;
    const lease = new SessionLease("admin-4", () => { lost++; }, server.client());
    await lease.acquire();
    server.keys.set("admin-4", "replacement");
    await (lease as unknown as { renew(): Promise<void> }).renew();
    expect(lost).toBe(1);
    expect(await lease.assertOwned()).toBe(false);
    await lease.release();
  });
});
