import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";

import { EntitySchema } from "@mikro-orm/core";
import { MikroORM, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { CommandFactory, CommandModule } from "@nest-boot/command";
import {
  HealthCheckModule,
  HealthCheckRegistry,
} from "@nest-boot/health-check";

import { DatabaseModule } from "../dist/database.module.js";

const databaseUrl = process.env.DATABASE_URL;
const record = new EntitySchema({
  name: "DatabaseCreateRecord",
  properties: { id: { type: "integer", primary: true } },
});

describe.skipIf(!databaseUrl)("database:create with health checks", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it.each([
    {
      name: "default database initialization",
      options: {},
      existsAtBootstrap: true,
    },
    {
      name: "automatic database creation disabled",
      options: { ensureDatabase: false },
      existsAtBootstrap: false,
    },
  ])(
    "creates a missing PostgreSQL database with $name",
    async ({ options, existsAtBootstrap }) => {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required for PostgreSQL E2E tests");
      }
      const management = await MikroORM.init({
        clientUrl: databaseUrl,
        entities: [record],
        ensureDatabase: false,
      });
      const name = `nb_create_${randomUUID().replaceAll("-", "")}`;
      const target = new URL(databaseUrl);
      target.pathname = `/${name}`;
      let output = "";
      let healthChecksAtBootstrap = 0;
      let databaseExistedAtBootstrap = false;
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          output += String(chunk);
          callback();
        },
      });
      try {
        expect(
          await management.em.execute(
            "select 1 from pg_database where datname = ?",
            [name],
          ),
        ).toEqual([]);
        const result = await CommandFactory.run(
          {
            module: class AppModule {},
            imports: [
              CommandModule,
              HealthCheckModule,
              DatabaseModule.forRoot({
                driver: PostgreSqlDriver,
                clientUrl: target.toString(),
                entities: [record],
                ...options,
              }),
            ],
            providers: [
              {
                provide: Symbol("BootstrapObserver"),
                inject: [HealthCheckRegistry],
                useFactory: (registry: HealthCheckRegistry) => ({
                  async onApplicationBootstrap() {
                    healthChecksAtBootstrap = registry.healthIndicators.length;
                    const rows = await management.em.execute(
                      "select 1 from pg_database where datname = ?",
                      [name],
                    );
                    databaseExistedAtBootstrap = rows.length > 0;
                  },
                }),
              },
            ],
          },
          {
            args: ["database:create"],
            context: { stdout: stream, stderr: stream },
          },
        );
        expect(result, output).toBe(0);
        expect(healthChecksAtBootstrap).toBe(1);
        expect(databaseExistedAtBootstrap).toBe(existsAtBootstrap);
        expect(output).toContain("Database is ready.");
        expect(
          await management.em.execute(
            "select datname from pg_database where datname = ?",
            [name],
          ),
        ).toEqual([{ datname: name }]);
      } finally {
        await management.schema.dropDatabase(name);
        await management.close();
      }
    },
    30000,
  );
});
