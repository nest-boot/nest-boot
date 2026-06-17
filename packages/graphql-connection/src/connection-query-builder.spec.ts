import "reflect-metadata";

import type { EntityManager } from "@mikro-orm/core";

import { ConnectionQueryBuilder } from "./connection-query-builder";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants";
import type {
  ConnectionFieldOptions,
  ConnectionMetadata,
  FieldOptions,
} from "./interfaces";
import type { ConnectionClass } from "./types";
import { createFilter } from "./utils";

interface Book {
  id: number;
  title: string;
  searchableTitle: string;
}

class BookEntity implements Book {
  id!: number;

  title!: string;

  searchableTitle!: string;
}

class BookConnection {}

describe("ConnectionQueryBuilder", () => {
  it("maps query string fulltext searches to a configured fulltext field path", async () => {
    const titleField = {
      field: "title",
      type: "string",
      filterable: true,
      searchable: true,
      fulltext: "searchableTitle",
    } satisfies FieldOptions<Book, "string", "searchableTitle">;
    const fieldOptionsMap = new Map<string, ConnectionFieldOptions<Book>>([
      ["title", titleField],
    ]);
    const { filterQuerySchema } = createFilter("Book", fieldOptionsMap);

    Reflect.defineMetadata(
      GRAPHQL_CONNECTION_METADATA,
      {
        entityClass: BookEntity,
        fieldOptionsMap,
        filterQuerySchema,
      } satisfies ConnectionMetadata<Book>,
      BookConnection,
    );

    const find = jest.fn().mockResolvedValue([]);
    const entityManager = {
      find,
      findAll: jest.fn().mockResolvedValue([]),
    } as unknown as EntityManager;

    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      { first: 10, query: "title:search" },
    ).query();

    expect(find).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      { searchableTitle: { $fulltext: "search" } },
      expect.objectContaining({ limit: 11 }),
    );
  });
});
