import { MikroORM } from "@mikro-orm/core";
import { ReflectMetadataProvider } from "@mikro-orm/decorators/legacy";
import { PgliteDriver } from "@mikro-orm/pglite";
import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DatabaseHealthIndicator, DatabaseModule } from "../dist/index.js";
import { TestEntity } from "./entities/test.entity.js";

describe("Database health HTTP integration", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(
    enabled = true,
    asyncRegistration = false,
    connect = true,
  ) {
    const options = {
      driver: PgliteDriver,
      dbName: "memory://",
      entities: [TestEntity],
      metadataProvider: ReflectMetadataProvider,
    };
    const databaseModule = asyncRegistration
      ? DatabaseModule.forRootAsync({
          driverHint: PgliteDriver,
          useFactory: async () => {
            await Promise.resolve();
            return options;
          },
        })
      : DatabaseModule.forRoot(options);
    const module = await Test.createTestingModule({
      imports: [databaseModule, ...(enabled ? [HealthCheckModule] : [])],
    })
      .setLogger({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
      .compile();
    app = module.createNestApplication();
    const orm = app.get<MikroORM<PgliteDriver>>(MikroORM);
    if (connect) await orm.connect();
    const connection = orm.em.getConnection();
    const probe = vi.spyOn(connection, "checkConnection");
    await app.listen(0, "127.0.0.1");
    return { orm, connection, probe };
  }

  async function health() {
    const response = await fetch(`${await app.getUrl()}/api/health`);
    const body: unknown = await response.json();
    return { status: response.status, body };
  }

  it.each([false, true])(
    "registers only when health checks are enabled: %s",
    async (enabled) => {
      const { probe } = await createApp(enabled);
      expect(app.get(DatabaseHealthIndicator)).toBeInstanceOf(
        DatabaseHealthIndicator,
      );
      expect(probe).not.toHaveBeenCalled();
      if (enabled) {
        expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(1);
        expect(await health()).toMatchObject({
          status: 200,
          body: { details: { database: { status: "up" } } },
        });
        expect(probe).toHaveBeenCalledOnce();
      } else {
        expect((await health()).status).toBe(404);
        expect(probe).not.toHaveBeenCalled();
      }
    },
  );

  it("registers the asynchronously configured ORM connection", async () => {
    const { probe } = await createApp(true, true);
    expect(app.get(HealthCheckRegistry).healthIndicators).toHaveLength(1);
    expect((await health()).status).toBe(200);
    expect(probe).toHaveBeenCalledOnce();
  });

  it("initializes a lazy connection during startup and stays down after close until the application reconnects", async () => {
    const { orm, connection } = await createApp(true, false, false);
    expect(await connection.isConnected()).toBe(true);
    await orm.close(true);
    const connect = vi.spyOn(connection, "connect");
    expect(await health()).toMatchObject({
      status: 503,
      body: { error: { database: { status: "down" } } },
    });
    expect(connect).not.toHaveBeenCalled();
    await orm.connect();
    expect((await health()).status).toBe(200);
    expect(await connection.isConnected()).toBe(true);
  });

  it.each(["orm", "client"] as const)(
    "returns 503 after closing the %s and recovers after reconnecting",
    async (target) => {
      const { orm, connection } = await createApp();
      if (target === "orm") await orm.close(true);
      else {
        const client = await connection.getNativeClient();
        await client.close();
      }
      expect(await health()).toMatchObject({
        status: 503,
        body: { error: { database: { status: "down" } } },
      });
      await orm.reconnect();
      expect((await health()).status).toBe(200);
    },
  );

  it("supports custom result keys and timeouts", async () => {
    await createApp();
    const indicator = app.get(DatabaseHealthIndicator);
    expect(await indicator.pingCheck("primary", 1000)).toMatchObject({
      primary: { status: "up" },
    });
  });

  it("bounds a stalled database query, shares it across HTTP probes, and recovers", async () => {
    const { connection, probe } = await createApp();
    const client = await connection.getNativeClient();
    const query = client.query.bind(client);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const querySpy = vi
      .spyOn(client, "query")
      .mockImplementationOnce(async (...args) => {
        await pending;
        return await query(...args);
      });
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(await health()).toMatchObject({
          status: 503,
          body: {
            error: {
              database: {
                status: "down",
                message: "timeout of 1000ms exceeded",
              },
            },
          },
        });
      }
      expect(probe).toHaveBeenCalledOnce();
      expect(querySpy).toHaveBeenCalledOnce();
    } finally {
      release();
      await querySpy.mock.results[0]?.value;
      querySpy.mockRestore();
    }
    expect((await health()).status).toBe(200);
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
