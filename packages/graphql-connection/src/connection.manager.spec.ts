import "reflect-metadata";

import { EntityManager } from "@mikro-orm/core";
import { SqlEntityManager } from "@mikro-orm/sql";
import { ObjectType, TypeMetadataStorage } from "@nest-boot/graphql";

import { ConnectionBuilder } from "./connection.builder.js";
import { ConnectionManager } from "./connection.manager.js";

interface ManagerBook {
  id: number;
  title: string;
}

class ManagerBookEntity implements ManagerBook {
  id!: number;

  title!: string;
}

describe("ConnectionManager", () => {
  it("only accepts connection classes in its public type", () => {
    expect(
      false satisfies string extends Parameters<ConnectionManager["find"]>[0]
        ? true
        : false,
    ).toBe(false);
  });
  it("injects the core entity manager token shared by SQL drivers", () => {
    expect(Reflect.getMetadata("self:paramtypes", ConnectionManager)).toEqual([
      { index: 0, param: EntityManager },
    ]);
  });

  it.each(["generated class", "subclass"])(
    "executes a connection query by %s with additional find options",
    async (reference) => {
      TypeMetadataStorage.clear();
      const { Connection } = new ConnectionBuilder(ManagerBookEntity)
        .addField({
          field: "title",
          type: "string",
          filterable: true,
          sortable: true,
        })
        .build();
      @ObjectType("ManagerBookEntityConnection")
      class ApplicationConnection extends Connection {}
      const rows = [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
      ];
      const find = vi.fn().mockResolvedValue(rows);
      const findAll = vi.fn().mockResolvedValue(rows);
      const entityManager = {
        find,
        findAll,
      } as unknown as SqlEntityManager;

      const manager = new ConnectionManager(entityManager);
      const connection =
        reference === "generated class" ? Connection : ApplicationConnection;
      const result = await manager.find<ManagerBook>(
        connection,
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
      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    },
  );
});
