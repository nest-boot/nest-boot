import { MikroORM } from "@mikro-orm/core";
import {
  EntityManager as PgliteEntityManager,
  PgliteDriver,
} from "@mikro-orm/pglite";
import { Test } from "@nestjs/testing";

import { MikroOrmModule } from "../src/index.js";
import { TestEntity } from "./entities/test.entity.js";

describe("MikroOrmModule driver integration", () => {
  it("registers the driver-specific entity manager", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({
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

    await moduleRef.close();
  });

  it("keeps metadata caching disabled with partial async options", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRootAsync({
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
