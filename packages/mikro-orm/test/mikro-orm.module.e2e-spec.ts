import { MikroORM } from "@mikro-orm/core";
import {
  EntityManager as SqliteEntityManager,
  SqliteDriver,
} from "@mikro-orm/sqlite";
import { Test } from "@nestjs/testing";

import { MikroOrmModule } from "../src/index.js";
import { TestEntity } from "./entities/test.entity.js";

describe("MikroOrmModule driver integration", () => {
  it("registers the driver-specific entity manager", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({
          driver: SqliteDriver,
          dbName: ":memory:",
          entities: [TestEntity],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const orm = moduleRef.get(MikroORM);

    expect(moduleRef.get(SqliteEntityManager)).toBe(orm.em);

    await moduleRef.close();
  });
});
