import { EntitySchema, MikroORM } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DatabaseModule } from "./database.module.js";

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

it.each([true, false, true])(
  "collects async module entities before initializing ORM (enabled: %s)",
  async (enabled) => {
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
  },
  15000,
);

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
