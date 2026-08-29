import "reflect-metadata";

import { SqlEntityManager } from "@mikro-orm/knex";
import { type GraphQLResolveInfo, Kind, parse } from "graphql";

import { ConnectionBuilder } from "./connection.builder";
import { ConnectionManager } from "./connection.manager";
import { TotalCountRelation } from "./enums";

interface ManagerBook {
  id: number;
  title: string;
}

class ManagerBookEntity implements ManagerBook {
  id!: number;

  title!: string;
}

function createResolveInfo(source: string): GraphQLResolveInfo {
  const document = parse(source);
  const operation = document.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );

  if (operation?.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error("Operation definition not found");
  }

  const fieldNode = operation.selectionSet.selections.find(
    (selection) => selection.kind === Kind.FIELD,
  );

  if (fieldNode?.kind !== Kind.FIELD) {
    throw new Error("Connection field not found");
  }

  return {
    fieldNodes: [fieldNode],
    fragments: Object.fromEntries(
      document.definitions
        .filter((definition) => definition.kind === Kind.FRAGMENT_DEFINITION)
        .map((definition) => [definition.name.value, definition]),
    ),
    variableValues: {},
  } as unknown as GraphQLResolveInfo;
}

describe("ConnectionManager", () => {
  it("declares a SQL entity manager dependency", () => {
    expect(Reflect.getMetadata("design:paramtypes", ConnectionManager)).toEqual(
      [SqlEntityManager],
    );
  });

  it("executes a connection query with additional find options", async () => {
    const { Connection } = new ConnectionBuilder(ManagerBookEntity)
      .addField({
        field: "title",
        type: "string",
        filterable: true,
        sortable: true,
      })
      .build();
    const rows = [
      { id: 1, title: "A" },
      { id: 2, title: "B" },
    ];
    const find = jest.fn().mockResolvedValue(rows);
    const findAll = jest.fn().mockResolvedValue(rows);
    const limitedCountQueryBuilder = {
      applyFilters: jest.fn().mockResolvedValue(undefined),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      withSchema: jest.fn().mockReturnThis(),
    };
    const countQueryBuilder = {
      count: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(rows.length),
    };
    const createQueryBuilder = jest
      .fn()
      .mockReturnValueOnce(limitedCountQueryBuilder)
      .mockReturnValueOnce(countQueryBuilder);
    const entityManager = {
      createQueryBuilder,
      find,
      findAll,
    } as unknown as SqlEntityManager;

    const result = await new ConnectionManager(entityManager).find(
      Connection,
      {
        first: 1,
        filter: { title: { $eq: "A" } },
      },
      {
        where: { id: { $gt: 0 } },
        disableIdentityMap: true,
        filters: false,
        schema: "tenant",
      },
    );

    expect(find).toHaveBeenNthCalledWith(
      1,
      ManagerBookEntity,
      {
        $and: [{ id: { $gt: 0 } }, { title: { $eq: "A" } }],
      },
      expect.objectContaining({
        disableIdentityMap: true,
        filters: false,
        limit: 2,
        orderBy: [{ id: "ASC" }],
        schema: "tenant",
        where: { id: { $gt: 0 } },
      }),
    );
    expect(limitedCountQueryBuilder.where).toHaveBeenCalledWith({
      $and: [{ id: { $gt: 0 } }, { title: { $eq: "A" } }],
    });
    expect(limitedCountQueryBuilder.applyFilters).toHaveBeenCalledWith(false);
    expect(limitedCountQueryBuilder.withSchema).toHaveBeenCalledWith("tenant");
    expect(result.totalCount).toBe(2);
    expect(result.totalCountRelation).toBe(TotalCountRelation.EQ);
    expect(result.edges).toHaveLength(1);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
  });

  it("skips the total count query when count fields are not selected", async () => {
    const { Connection } = new ConnectionBuilder(ManagerBookEntity).build();
    const findAll = jest.fn().mockResolvedValue([]);
    const createQueryBuilder = jest.fn();
    const entityManager = {
      createQueryBuilder,
      find: jest.fn(),
      findAll,
    } as unknown as SqlEntityManager;

    const result = await new ConnectionManager(entityManager).find(
      Connection,
      { first: 10 },
      {
        info: createResolveInfo(`
          query {
            books {
              edges {
                cursor
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        `),
      },
    );

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(createQueryBuilder).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("totalCount");
    expect(result).not.toHaveProperty("totalCountRelation");
  });

  it("executes the total count query when totalCountRelation is selected", async () => {
    const { Connection } = new ConnectionBuilder(ManagerBookEntity).build();
    const limitedCountQueryBuilder = {
      applyFilters: jest.fn().mockResolvedValue(undefined),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      withSchema: jest.fn().mockReturnThis(),
    };
    const countQueryBuilder = {
      count: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(10_001),
    };
    const createQueryBuilder = jest
      .fn()
      .mockReturnValueOnce(limitedCountQueryBuilder)
      .mockReturnValueOnce(countQueryBuilder);
    const entityManager = {
      createQueryBuilder,
      find: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as SqlEntityManager;

    const result = await new ConnectionManager(entityManager).find(
      Connection,
      { first: 10 },
      {
        info: createResolveInfo(`
          query {
            books {
              ...CountFields
            }
          }

          fragment CountFields on ManagerBookEntityConnection {
            relation: totalCountRelation
          }
        `),
      },
    );

    expect(createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(result.totalCount).toBe(10_000);
    expect(result.totalCountRelation).toBe(TotalCountRelation.GTE);
  });
});
