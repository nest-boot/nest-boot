import "reflect-metadata";

import type { EntityManager } from "@mikro-orm/core";

import { ConnectionBuilder } from "./connection.builder";
import { ConnectionManager } from "./connection.manager";

interface ManagerBook {
  id: number;
  title: string;
}

class ManagerBookEntity implements ManagerBook {
  id!: number;

  title!: string;
}

describe("ConnectionManager", () => {
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
    const entityManager = {
      find,
      findAll,
    } as unknown as EntityManager;

    const result = await new ConnectionManager(entityManager).find(
      Connection,
      {
        first: 1,
        filter: { title: { $eq: "A" } },
      },
      {
        where: { id: { $gt: 0 } },
        disableIdentityMap: true,
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
        limit: 2,
        orderBy: [{ id: "ASC" }],
        where: { id: { $gt: 0 } },
      }),
    );
    expect(result.totalCount).toBe(2);
    expect(result.edges).toHaveLength(1);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(false);
  });
});
