import type { MikroORM } from "@mikro-orm/core";
import { HealthCheckRegistry } from "@nest-boot/health-check";

import { DatabaseHealthIndicator } from "../src/database-health.indicator.js";

describe("DatabaseHealthIndicator", () => {
  function setup(registry?: HealthCheckRegistry) {
    const connection = {
      ensureConnection: vi.fn(() => Promise.resolve()),
      checkConnection: vi.fn<MikroORM["checkConnection"]>(() =>
        Promise.resolve({ ok: true }),
      ),
    };
    const orm = {
      em: { getConnection: () => connection },
      checkConnection: connection.checkConnection,
    } as unknown as MikroORM;
    const indicator = new DatabaseHealthIndicator(orm, registry);
    const ping = vi.spyOn(indicator, "pingCheck");
    return { connection, indicator, ping };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function check(registry: HealthCheckRegistry) {
    const results = await Promise.all(
      registry.healthIndicators.map((indicator) =>
        Promise.resolve(
          typeof indicator === "function" ? indicator() : indicator,
        ),
      ),
    );
    return results[0];
  }

  it("initializes the existing connection and registers a deferred database check", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator, ping } = setup(registry);
    await indicator.onModuleInit();
    expect(registry.healthIndicators).toHaveLength(1);
    expect(connection.ensureConnection).toHaveBeenCalledOnce();
    expect(connection.checkConnection).not.toHaveBeenCalled();
    expect(await check(registry)).toMatchObject({ database: { status: "up" } });
    expect(ping).toHaveBeenCalledWith();
    expect(connection.checkConnection).toHaveBeenCalledOnce();
  });

  it("does not enable health checks without HealthCheckModule", async () => {
    const { connection, indicator, ping } = setup();
    await indicator.onModuleInit();
    expect(connection.checkConnection).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
    expect(connection.ensureConnection).not.toHaveBeenCalled();
  });

  it("reports a disconnected connection and recovery", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator } = setup(registry);
    await indicator.onModuleInit();
    connection.checkConnection.mockResolvedValueOnce({
      ok: false,
      reason: "Connection not established",
    });
    expect(await check(registry)).toMatchObject({
      database: { status: "down", message: "Connection not established" },
    });
    expect(await check(registry)).toMatchObject({ database: { status: "up" } });
    expect(connection.checkConnection).toHaveBeenCalledTimes(2);
  });

  it("does not initialize an unready connection again during probes", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator } = setup(registry);
    await indicator.onModuleInit();
    connection.checkConnection.mockResolvedValue({
      ok: false,
      reason: "Connection not established",
    });
    expect(await check(registry)).toMatchObject({
      database: { status: "down" },
    });
    expect(await check(registry)).toMatchObject({
      database: { status: "down" },
    });
    expect(connection.ensureConnection).toHaveBeenCalledOnce();
    connection.checkConnection.mockResolvedValue({ ok: true });
    expect(await check(registry)).toMatchObject({ database: { status: "up" } });
    expect(connection.ensureConnection).toHaveBeenCalledOnce();
    expect(connection.checkConnection).toHaveBeenCalledTimes(3);
  });

  it("fails startup without registering a check when connection initialization fails", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator } = setup(registry);
    connection.ensureConnection.mockRejectedValueOnce(
      new Error("initialization failed"),
    );
    await expect(indicator.onModuleInit()).rejects.toThrow(
      "initialization failed",
    );
    expect(registry.healthIndicators).toHaveLength(0);
    expect(connection.checkConnection).not.toHaveBeenCalled();
  });

  it("handles a rejected check and retries after it settles", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator } = setup(registry);
    await indicator.onModuleInit();
    connection.checkConnection.mockRejectedValueOnce(
      new Error("connection lost"),
    );
    expect(await check(registry)).toMatchObject({
      database: { status: "down", message: "connection lost" },
    });
    expect(await check(registry)).toMatchObject({ database: { status: "up" } });
  });

  it("supports a custom result key without requiring automatic registration", async () => {
    const { connection, indicator } = setup();
    expect(await indicator.pingCheck("primary", 100)).toMatchObject({
      primary: { status: "up" },
    });
    expect(connection.ensureConnection).not.toHaveBeenCalled();
    expect(connection.checkConnection).toHaveBeenCalledOnce();
  });

  it("shares a pending connection probe across concurrent requests", async () => {
    const registry = new HealthCheckRegistry();
    const { connection, indicator } = setup(registry);
    await indicator.onModuleInit();
    let complete!: (
      value: Awaited<ReturnType<MikroORM["checkConnection"]>>,
    ) => void;
    const pending = new Promise<
      Awaited<ReturnType<MikroORM["checkConnection"]>>
    >((resolve) => {
      complete = resolve;
    });
    connection.checkConnection.mockReturnValueOnce(pending);
    const first = check(registry);
    const second = check(registry);
    try {
      await vi.waitFor(() => {
        expect(connection.checkConnection).toHaveBeenCalledOnce();
      });
    } finally {
      complete({ ok: true });
    }
    expect(await first).toMatchObject({ database: { status: "up" } });
    expect(await second).toMatchObject({ database: { status: "up" } });
  });

  it.each(["resolve", "reject"] as const)(
    "reuses a timed-out probe and retries after it eventually %ss",
    async (settlement) => {
      const registry = new HealthCheckRegistry();
      const { connection, indicator, ping } = setup(registry);
      await indicator.onModuleInit();
      const pingCheck =
        DatabaseHealthIndicator.prototype.pingCheck.bind(indicator);
      ping.mockImplementation((key) => pingCheck(key, 10));
      let complete!: (
        value: Awaited<ReturnType<MikroORM["checkConnection"]>>,
      ) => void;
      let reject!: (reason: Error) => void;
      const pending = new Promise<
        Awaited<ReturnType<MikroORM["checkConnection"]>>
      >((resolve, fail) => {
        complete = resolve;
        reject = fail;
      });
      connection.checkConnection.mockReturnValueOnce(pending);
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          expect(await check(registry)).toMatchObject({
            database: { status: "down", message: "timeout of 10ms exceeded" },
          });
        }
        expect(connection.checkConnection).toHaveBeenCalledOnce();
      } finally {
        if (settlement === "resolve") complete({ ok: true });
        else reject(new Error("late failure"));
        await pending.catch(() => undefined);
        ping.mockRestore();
      }
      expect(await check(registry)).toMatchObject({
        database: { status: "up" },
      });
      expect(connection.checkConnection).toHaveBeenCalledTimes(2);
    },
  );
});
