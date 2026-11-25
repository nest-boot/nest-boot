import { MikroORM } from "@mikro-orm/core";
import {
  EntityManager as PgliteEntityManager,
  PgliteDriver,
} from "@mikro-orm/pglite";
import { Test } from "@nestjs/testing";

import { DatabaseModule } from "../src/index.js";
import { TestEntity } from "./entities/test.entity.js";

describe("DatabaseModule driver integration", () => {
  it("registers the driver-specific entity manager", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [TestEntity],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const orm = moduleRef.get(MikroORM);

    expect(moduleRef.get(PgliteEntityManager)).toBe(orm.em);
    expect(orm.config.get("metadataCache").enabled).toBe(false);
    expect(orm.config.get("schemaGenerator").ignoreSchema).toEqual(["mastra"]);

    await moduleRef.close();
  });

  it("ignores the mastra schema during live schema diff by default and allows overriding", async () => {
    const defaultModuleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [TestEntity],
        }),
      ],
    }).compile();

    try {
      await defaultModuleRef.init();
      const orm = defaultModuleRef.get(MikroORM<PgliteDriver>);

      await orm.schema.create();
      await orm.em.execute('create schema if not exists "mastra"');
      await orm.em.execute(
        'create table "mastra"."mastra_threads" ("id" text primary key)',
      );

      const updateSql = await orm.schema.getUpdateSchemaSQL();
      expect(updateSql).not.toContain("mastra");
    } finally {
      await defaultModuleRef.close();
    }

    const overrideModuleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [TestEntity],
          schemaGenerator: {
            ignoreSchema: [],
          },
        }),
      ],
    }).compile();

    try {
      await overrideModuleRef.init();
      const orm = overrideModuleRef.get(MikroORM<PgliteDriver>);

      await orm.schema.create();
      await orm.em.execute('create schema if not exists "mastra"');
      await orm.em.execute(
        'create table "mastra"."mastra_threads" ("id" text primary key)',
      );

      const updateSql = await orm.schema.getUpdateSchemaSQL();
      expect(updateSql).toContain('"mastra"."mastra_threads"');
      expect(updateSql).toContain('drop schema if exists "mastra"');
    } finally {
      await overrideModuleRef.close();
    }
  });

  it("keeps metadata caching disabled with partial async options", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRootAsync({
          driverHint: PgliteDriver,
          useFactory: async () => {
            await Promise.resolve();
            return {
              driver: PgliteDriver,
              dbName: "memory://",
              entities: [TestEntity],
              metadataCache: { pretty: true },
            };
          },
        }),
      ],
    }).compile();

    try {
      await moduleRef.init();
      expect(moduleRef.get(MikroORM).config.get("metadataCache")).toMatchObject(
        {
          enabled: false,
          pretty: true,
        },
      );
    } finally {
      await moduleRef.close();
    }
  });
});
