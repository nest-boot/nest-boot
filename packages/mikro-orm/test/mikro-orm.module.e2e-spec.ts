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

    await moduleRef.close();
  });
});
