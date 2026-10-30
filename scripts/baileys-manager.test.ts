import { afterEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";

// All persistence/WA I/O is replaced: this suite never touches real sessions.
mock.module("../lib/db", () => ({
  db: {
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
    select: () => ({ from: () => ({ where: async () => [{ value: 2 }] }) }),
  },
}));

let nextConnection: "open" | "close" = "open";
const sockets: { ev: EventEmitter; end: () => Promise<void> }[] = [];
mock.module("@whiskeysockets/baileys", () => ({
  DisconnectReason: { loggedOut: 401, connectionReplaced: 440, badSession: 500, forbidden: 403 },
  useMultiFileAuthState: async () => ({ state: {}, saveCreds: async () => {} }),
  makeWASocket: () => {
    const ev = new EventEmitter();
    const socket = {
      ev,
      end: async () => { ev.emit("connection.update", { connection: "close" }); },
      sendMessage: async () => ({ key: { id: "fake-message" } }),
    };
    sockets.push(socket);
    queueMicrotask(() => ev.emit("connection.update", { connection: nextConnection }));
    return socket;
  },
}));

const { BaileysManager } = await import("../lib/wa/baileys-manager");
const { BaileysProvider } = await import("../lib/wa/baileys-provider");

function session(id: string) {
  const manager = BaileysManager.getInstance(id);
  const internals = manager as unknown as {
    lease: { assertOwned(): Promise<boolean>; release(): Promise<void> } | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    connecting: boolean;
    sock: { sendMessage: () => Promise<unknown> } | null;
    pausedUntil: number;
  };
  internals.lease = { assertOwned: async () => true, release: async () => {} };
  return { manager, internals };
}

afterEach(async () => {
  await BaileysManager.disconnectAll();
  sockets.length = 0;
  nextConnection = "open";
});

describe("Baileys manager", () => {
  test("a rejected queued task does not poison later sends", async () => {
    const { manager } = session("test-rejected-chain");
    const failed = manager.enqueue(async () => { throw new Error("pre-send failure"); });
    const next = manager.enqueue(async () => "next-message");
    await expect(failed).rejects.toThrow("pre-send failure");
    expect(await next).toBe("next-message");
  });

  test("an early close during connect schedules reconnect after connecting is cleared", async () => {
    const { manager, internals } = session("test-early-close");
    nextConnection = "close";
    await manager.connect();
    expect(internals.connecting).toBe(false);
    expect(internals.reconnectTimer).not.toBeNull();
    expect(manager.isConnected()).toBe(false);
  });

  test("disconnect ends the v7 socket and cancels reconnect", async () => {
    const { manager, internals } = session("test-disconnect");
    await manager.connect();
    expect(manager.isConnected()).toBe(true);
    const end = mock(async () => {});
    sockets[0].end = end;
    await manager.disconnect();
    expect(end).toHaveBeenCalledTimes(1);
    expect(internals.reconnectTimer).toBeNull();
    expect(manager.isConnected()).toBe(false);
  });

  test("provider cache refresh cannot undo manual disconnect; explicit connect can", async () => {
    const { manager } = session("test-explicit-connect");
    await manager.connect();
    await BaileysManager.disconnect("test-explicit-connect");
    expect(BaileysManager.getInstance("test-explicit-connect")).toBe(manager);
    await new BaileysProvider("test-explicit-connect").ensureReady();
    expect(sockets).toHaveLength(1);
    // Inject a fake lease again, since graceful disconnect released it.
    session("test-explicit-connect");
    await manager.connect(true);
    expect(sockets).toHaveLength(2);
    expect(manager.isConnected()).toBe(true);
  });

  test("100 jobs across rebuilt providers are serialised and paced on one session", async () => {
    const { manager, internals } = session("test-burst");
    await manager.connect();
    let active = 0;
    let maxActive = 0;
    const starts: number[] = [];
    internals.sock!.sendMessage = async () => {
      maxActive = Math.max(maxActive, ++active);
      starts.push(Date.now());
      await Bun.sleep(1);
      active--;
      return { key: { id: `message-${starts.length}` } };
    };
    const providers = Array.from({ length: 10 }, () => new BaileysProvider("test-burst"));
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) =>
      providers[index % providers.length].sendText("6281234567890", "eTPP test"),
    ));
    expect(results.every(result => result.success)).toBe(true);
    expect(starts).toHaveLength(100);
    expect(maxActive).toBe(1);
    expect(starts[99] - starts[0]).toBeGreaterThanOrEqual(190);
  });

  test("invalid numbers fail permanently without calling sendMessage", async () => {
    const { manager, internals } = session("test-invalid");
    await manager.connect();
    const send = mock(async () => ({ key: { id: "never" } }));
    internals.sock!.sendMessage = send;
    expect((await manager.sendText("invalid", "test")).failureKind).toBe("permanent");
    expect(send).not.toHaveBeenCalled();
  });

  test("three uncertain submissions pause only this session; queued sends are not submitted", async () => {
    const { manager, internals } = session("test-pause");
    await manager.connect();
    const send = mock(async () => { throw new Error("connection lost after submission"); });
    internals.sock!.sendMessage = send;
    for (let i = 0; i < 3; i++) {
      expect((await manager.sendText("6281234567890", "test")).failureKind).toBe("uncertain");
    }
    expect((await manager.sendText("6281234567890", "test")).failureKind).toBe("disconnected");
    expect(send).toHaveBeenCalledTimes(3);
    expect(internals.pausedUntil).toBeGreaterThan(Date.now());
  });

  test("lost ownership prevents a send even if the socket still looks connected", async () => {
    const { manager, internals } = session("test-fenced");
    await manager.connect();
    internals.lease!.assertOwned = async () => false;
    const send = mock(async () => ({ key: { id: "never" } }));
    internals.sock!.sendMessage = send;
    expect((await manager.sendText("6281234567890", "test")).failureKind).toBe("disconnected");
    expect(send).not.toHaveBeenCalled();
  });
});
