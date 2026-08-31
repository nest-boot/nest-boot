import "reflect-metadata";

import { EntityManager } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/sqlite";
import { RequestContext } from "@nest-boot/request-context";

import { EntityService } from "../src/services/entity.service.js";
import { TestEntity } from "./entities/test.entity.js";

describe("EntityService request context integration", () => {
  let orm: MikroORM;
  let service: EntityService<TestEntity>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      allowGlobalContext: true,
      context: () => {
        if (RequestContext.isActive()) {
          return RequestContext.get(EntityManager);
        }
      },
      dbName: ":memory:",
      entities: [TestEntity],
    });
    await orm.schema.create();
    await orm.em.insertMany(
      TestEntity,
      [1, 2, 3, 4].map((id) => new TestEntity({ id })),
    );
    orm.em.clear();
    service = new EntityService(TestEntity, orm.em);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  async function loadInRequest(ids: number[]) {
    return await RequestContext.run(
      new RequestContext({ type: "test" }),
      async (ctx) => {
        const em = orm.em.fork({ useContext: true });
        const find = vi.spyOn(em, "find");
        ctx.set(EntityManager, em);

        const entities = await Promise.all(
          ids.map(async (id) => await service.findOne(id)),
        );

        return {
          find,
          ids: entities.map((entity) => entity?.id),
        };
      },
    );
  }

  it("should batch within a request and isolate concurrent requests", async () => {
    const [first, second] = await Promise.all([
      loadInRequest([1, 2]),
      loadInRequest([3, 4]),
    ]);

    expect(first.ids).toEqual([1, 2]);
    expect(first.find).toHaveBeenCalledTimes(1);
    expect(second.ids).toEqual([3, 4]);
    expect(second.find).toHaveBeenCalledTimes(1);
  });
});
