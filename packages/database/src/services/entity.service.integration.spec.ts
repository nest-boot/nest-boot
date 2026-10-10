import { EntitySchema, wrap } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { NotFoundException } from "@nestjs/common";

import { EntityService } from "./entity.service.js";

class ReferenceItem {
  id!: number;
  name!: string;
}

const schema = new EntitySchema({
  class: ReferenceItem,
  properties: {
    id: { type: "number", primary: true },
    name: { type: "string" },
  },
});

describe("EntityService reference hydration", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({ entities: [schema], dbName: "memory://" });
    await orm.schema.create();
    await orm.em.fork().insertMany(ReferenceItem, [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ]);
  });

  afterAll(async () => {
    await orm.close(true);
  });

  it("hydrates an identity-map reference instead of returning only its ID", async () => {
    const em = orm.em.fork();
    const reference = em.getReference(ReferenceItem, 1);
    const service = new EntityService(ReferenceItem, em);

    expect(wrap(reference).isInitialized()).toBe(false);
    const found = await service.findOne(reference);
    expect(found).toBe(reference);
    expect(found?.name).toBe("First");
    expect(wrap(reference).isInitialized()).toBe(true);
  });

  it("does not treat a reference to a missing row as an existing entity", async () => {
    const em = orm.em.fork();
    em.getReference(ReferenceItem, 404);
    const service = new EntityService(ReferenceItem, em);

    await expect(service.findOne(404)).resolves.toBeNull();
    await expect(service.findOneOrFail(404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("keeps initialized cache hits while batching references and missing IDs", async () => {
    const em = orm.em.fork();
    const loaded = await em.findOneOrFail(ReferenceItem, 1);
    const reference = em.getReference(ReferenceItem, 2);
    const find = vi.spyOn(em, "find");
    const service = new EntityService(ReferenceItem, em);

    const result = await Promise.all([
      service.findOne(1),
      service.findOne(2),
      service.findOne(404),
    ]);
    expect(result).toEqual([loaded, reference, null]);
    expect(reference.name).toBe("Second");
    expect(find).toHaveBeenCalledExactlyOnceWith(
      ReferenceItem,
      { id: { $in: [2, 404] } },
      { limit: 2 },
    );
  });
});
