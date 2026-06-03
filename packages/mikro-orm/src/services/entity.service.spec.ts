import { EntityManager, QueryOrder } from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";

import { EntityService } from "./entity.service";

class TestEntity {
  id!: number;
  name?: string;
  deletedAt?: Date;
}

function createEntity(id: number, data: Partial<TestEntity> = {}) {
  return Object.assign(new TestEntity(), {
    id,
    ...data,
  });
}

function createEntityManager() {
  const getById = jest.fn();
  const em = {
    assign: jest.fn(),
    count: jest.fn(),
    create: jest.fn((_entityClass, data) => createEntity(data.id, data)),
    find: jest.fn(),
    findOne: jest.fn(),
    flush: jest.fn(),
    getUnitOfWork: jest.fn(() => ({
      getById,
    })),
    isInTransaction: jest.fn(() => false),
    remove: jest.fn(),
    transactional: jest.fn(async (handler) => await handler()),
  };

  return {
    em: em as unknown as EntityManager,
    getById,
    mocks: em,
  };
}

describe("EntityService", () => {
  it("should create and flush an entity", async () => {
    const { em, mocks } = createEntityManager();
    const service = new EntityService(TestEntity, em);

    await expect(
      service.create({
        id: 1,
        name: "created",
      }),
    ).resolves.toMatchObject({
      id: 1,
      name: "created",
    });

    expect(mocks.create).toHaveBeenCalledWith(
      TestEntity,
      {
        id: 1,
        name: "created",
      },
      {
        persist: true,
      },
    );
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it("should find one entity by plain filter query", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(1);
    mocks.findOne.mockResolvedValue(entity);
    const service = new EntityService(TestEntity, em);

    await expect(
      service.findOne({
        name: "found",
      }),
    ).resolves.toBe(entity);

    expect(mocks.findOne).toHaveBeenCalledWith(TestEntity, {
      name: "found",
    });
  });

  it("should find one entity by id from unit of work", async () => {
    const { em, getById, mocks } = createEntityManager();
    const entity = createEntity(1);
    getById.mockReturnValue(entity);
    const service = new EntityService(TestEntity, em);

    await expect(service.findOne(1)).resolves.toBe(entity);

    expect(getById).toHaveBeenCalledWith("TestEntity", 1);
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("should fetch an entity by id when it is not in unit of work", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(2);
    mocks.find.mockResolvedValue([entity]);
    const service = new EntityService(TestEntity, em);

    await expect(service.findOne(2)).resolves.toBe(entity);

    expect(mocks.find).toHaveBeenCalledWith(
      TestEntity,
      {
        id: {
          $in: [2],
        },
      },
      {
        limit: 1,
      },
    );
  });

  it("should resolve entity references by their id", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(3);
    mocks.find.mockResolvedValue([entity]);
    const service = new EntityService(TestEntity, em);

    await expect(service.findOne(createEntity(3))).resolves.toBe(entity);
  });

  it("should throw when findOneOrFail cannot find an entity", async () => {
    const { em, mocks } = createEntityManager();
    mocks.find.mockResolvedValue([]);
    const service = new EntityService(TestEntity, em);

    await expect(service.findOneOrFail(404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("should pass through findAll and count calls", async () => {
    const { em, mocks } = createEntityManager();
    const entities = [createEntity(1)];
    mocks.find.mockResolvedValue(entities);
    mocks.count.mockResolvedValue(1);
    const service = new EntityService(TestEntity, em);

    await expect(service.findAll({ name: "a" }, { limit: 5 })).resolves.toBe(
      entities,
    );
    await expect(
      service.count({ name: "a" }, { schema: "tenant_a" }),
    ).resolves.toBe(1);

    expect(mocks.find).toHaveBeenCalledWith(
      TestEntity,
      {
        name: "a",
      },
      {
        limit: 5,
      },
    );
    expect(mocks.count).toHaveBeenCalledWith(
      TestEntity,
      {
        name: "a",
      },
      {
        schema: "tenant_a",
      },
    );
  });

  it("should update existing entities and ignore undefined values", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(1, {
      name: "old",
    });
    mocks.find.mockResolvedValue([entity]);
    const service = new EntityService(TestEntity, em);
    const options = {
      mergeObjectProperties: true,
    };

    await expect(
      service.update(
        1,
        {
          deletedAt: undefined,
          name: "new",
        },
        options,
      ),
    ).resolves.toBe(entity);

    expect(mocks.assign).toHaveBeenCalledWith(
      entity,
      {
        name: "new",
      },
      options,
    );
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it("should throw when update cannot find an entity", async () => {
    const { em, mocks } = createEntityManager();
    mocks.find.mockResolvedValue([]);
    const service = new EntityService(TestEntity, em);

    await expect(
      service.update(404, {
        name: "missing",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("should soft-delete entities when the soft-delete key exists", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(1, {
      deletedAt: undefined,
    });
    mocks.find.mockResolvedValue([entity]);
    const service = new EntityService(TestEntity, em);

    await expect(service.remove(1)).resolves.toBe(entity);

    expect(entity.deletedAt).toBeInstanceOf(Date);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.transactional).toHaveBeenCalledTimes(1);
  });

  it("should remove entities directly inside an existing transaction", async () => {
    const { em, mocks } = createEntityManager();
    const entity = createEntity(1);
    mocks.find.mockResolvedValue([entity]);
    mocks.isInTransaction.mockReturnValue(true);
    const service = new EntityService(TestEntity, em);

    await expect(service.remove(1, false)).resolves.toBe(entity);

    expect(mocks.remove).toHaveBeenCalledWith(entity);
    expect(mocks.transactional).not.toHaveBeenCalled();
  });

  it("should throw when remove cannot find an entity", async () => {
    const { em, mocks } = createEntityManager();
    mocks.find.mockResolvedValue([]);
    const service = new EntityService(TestEntity, em);

    await expect(service.remove(404)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("should iterate entities by id chunks", async () => {
    const { em, mocks } = createEntityManager();
    const firstChunk = [createEntity(1), createEntity(2)];
    const secondChunk = [createEntity(3)];
    mocks.find
      .mockResolvedValueOnce(firstChunk)
      .mockResolvedValueOnce(secondChunk);
    const callback = jest.fn();
    const service = new EntityService(TestEntity, em);

    await expect(
      service.chunkById(
        {
          name: "active",
        },
        {
          limit: 2,
        },
        callback,
      ),
    ).resolves.toBe(service);

    expect(callback).toHaveBeenNthCalledWith(1, firstChunk);
    expect(callback).toHaveBeenNthCalledWith(2, secondChunk);
    expect(mocks.find).toHaveBeenNthCalledWith(
      2,
      TestEntity,
      {
        $and: [
          {
            name: "active",
          },
          {
            id: {
              $gt: 2,
            },
          },
        ],
      },
      {
        limit: 2,
        orderBy: {
          id: QueryOrder.ASC,
        },
      },
    );
  });
});
