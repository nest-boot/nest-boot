import { EntitySchema, MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DatabaseModule } from "../dist/database.module.js";
import { DatabaseEntityRegistry } from "../dist/infrastructure/database-entity-registry.js";

class CoreRecord {
  id!: number;
}
class OptionalRecord {
  id!: number;
}

const core = new EntitySchema({
  class: CoreRecord,
  properties: { id: { type: "integer", primary: true } },
});
const optional = new EntitySchema({
  class: OptionalRecord,
  properties: { id: { type: "integer", primary: true } },
});

describe("DatabaseModule feature entities", () => {
  it("collects async entities before discovery without leaking registrations between applications", async () => {
    for (const enabled of [true, false, true]) {
      const flag = Symbol("feature flag");
      @Module({
        providers: [{ provide: flag, useValue: enabled }],
        exports: [flag],
      })
      class FeatureOptionsModule {}
      const useFactory = vi.fn(async (value: boolean) => {
        await Promise.resolve();
        return value ? [optional, core] : [];
      });
      const app = await Test.createTestingModule({
        imports: [
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [core],
          }),
          DatabaseModule.forFeatureAsync({
            imports: [FeatureOptionsModule],
            inject: [flag],
            useFactory,
          }),
        ],
      }).compile();
      try {
        const orm = app.get(MikroORM);
        expect(orm.getMetadata().has(CoreRecord)).toBe(true);
        expect(orm.getMetadata().has(OptionalRecord)).toBe(enabled);
        expect(useFactory).toHaveBeenCalledExactlyOnceWith(enabled);
        expect(
          orm.config.get("entities").filter((entity) => entity === core),
        ).toHaveLength(1);
        await orm.schema.create();
      } finally {
        await app.close();
      }
    }
  });

  it("keeps explicit entities when automatic feature collection is disabled", async () => {
    const factory = vi.fn(() => [optional]);
    const app = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [core],
          autoLoadEntities: false,
        }),
        DatabaseModule.forFeatureAsync({ useFactory: factory }),
      ],
    }).compile();
    try {
      expect(app.get(MikroORM).getMetadata().has(CoreRecord)).toBe(true);
      expect(app.get(MikroORM).getMetadata().has(OptionalRecord)).toBe(false);
      expect(factory).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("resolves optional configuration dependencies without instantiating feature services", async () => {
    const absent = Symbol("absent");
    const factory = vi.fn((value: unknown) => (value ? [optional] : []));
    const app = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [core],
        }),
        DatabaseModule.forFeatureAsync({
          inject: [{ token: absent, optional: true }],
          useFactory: factory,
        }),
      ],
    }).compile();
    try {
      expect(factory).toHaveBeenCalledExactlyOnceWith(undefined);
    } finally {
      await app.close();
    }
  });

  it("isolates feature registrations by connection and shares concurrent resolutions", async () => {
    const factory = vi.fn(async () => {
      await Promise.resolve();
      return [optional];
    });
    const app = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [core],
        }),
        DatabaseModule.forFeatureAsync({
          contextName: "reporting",
          useFactory: factory,
        }),
      ],
    }).compile();
    try {
      expect(app.get(MikroORM).getMetadata().has(OptionalRecord)).toBe(false);
      expect(factory).not.toHaveBeenCalled();
      const registry = app.get(DatabaseEntityRegistry);
      const [first, second] = await Promise.all([
        registry.getEntities("reporting"),
        registry.getEntities("reporting"),
      ]);
      expect(first).toEqual([optional]);
      expect(second).toBe(first);
      expect(factory).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it("allows a feature factory to contribute an empty entity list", async () => {
    const factory = vi.fn(() => Promise.resolve([]));
    const app = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [core],
        }),
        DatabaseModule.forFeatureAsync({ useFactory: factory }),
      ],
    }).compile();
    try {
      const orm = app.get(MikroORM);
      expect(orm.getMetadata().has(CoreRecord)).toBe(true);
      expect(orm.getMetadata().has(OptionalRecord)).toBe(false);
      expect(factory).toHaveBeenCalledOnce();
      await orm.schema.create();
    } finally {
      await app.close();
    }
  });

  it("resolves configuration in each feature's imports and deduplicates both discovery lists", async () => {
    const flag = Symbol("module-local feature flag");
    @Module({
      providers: [{ provide: flag, useValue: true }],
      exports: [flag],
    })
    class EnabledOptionsModule {}
    @Module({
      providers: [{ provide: flag, useValue: false }],
      exports: [flag],
    })
    class DisabledOptionsModule {}
    const useFactory = vi.fn((enabled: boolean) =>
      enabled ? [optional, core] : [core],
    );
    const register = vi.fn();
    class CustomExtension {
      static register(orm: MikroORM): void {
        register(orm);
      }
    }
    const app = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [core],
          entitiesTs: [core],
          extensions: [CustomExtension, CustomExtension],
        }),
        DatabaseModule.forFeatureAsync({
          imports: [EnabledOptionsModule],
          inject: [flag],
          useFactory,
        }),
        DatabaseModule.forFeatureAsync({
          imports: [DisabledOptionsModule],
          inject: [flag],
          useFactory,
        }),
      ],
    }).compile();
    try {
      const orm = app.get(MikroORM);
      expect(orm.getMetadata().has(OptionalRecord)).toBe(true);
      expect(useFactory).toHaveBeenCalledTimes(2);
      expect(useFactory).toHaveBeenCalledWith(true);
      expect(useFactory).toHaveBeenCalledWith(false);
      for (const key of ["entities", "entitiesTs"] as const) {
        expect(orm.config.get(key)).toEqual([core, optional]);
      }
      expect(register).toHaveBeenCalledExactlyOnceWith(orm);
      expect(orm.migrator).toBeDefined();
      expect(orm.seeder).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
