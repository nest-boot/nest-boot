import "reflect-metadata";

import { type EntityManager, QueryOrder } from "@mikro-orm/core";

import { ConnectionQueryBuilder } from "./connection-query-builder";
import { Cursor } from "./cursor";
import { OrderDirection } from "./enums";
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
  isbn: string;
  searchableTitle: string;
}

class BookEntity implements Book {
  id!: number;

  title!: string;

  isbn!: string;

  searchableTitle!: string;
}

class BookConnection {}

function createFieldOptionsMap() {
  const titleField = {
    field: "title",
    type: "string",
    filterable: true,
    sortable: true,
    searchable: true,
    fulltext: "searchableTitle",
  } satisfies FieldOptions<Book, "string", "searchableTitle">;

  return new Map<string, ConnectionFieldOptions<Book>>([["title", titleField]]);
}

function setConnectionMetadata(
  fieldOptionsMap: Map<
    string,
    ConnectionFieldOptions<Book>
  > = createFieldOptionsMap(),
) {
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
}

function createEntityManager(entities: Book[] = []) {
  const find = jest.fn().mockResolvedValue(entities);
  const findAll = jest.fn().mockResolvedValue(entities);

  return {
    entityManager: { find, findAll } as unknown as EntityManager,
    find,
    findAll,
  };
}

describe("ConnectionQueryBuilder", () => {
  beforeEach(() => {
    setConnectionMetadata();
  });

  it("maps query string fulltext searches to a configured fulltext field path", async () => {
    const { entityManager, find } = createEntityManager();

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

  it("keeps query string searches on fields without fulltext enabled", async () => {
    const fieldOptionsMap = createFieldOptionsMap();
    const isbnField = {
      field: "isbn",
      type: "string",
      filterable: true,
    } satisfies FieldOptions<Book, "string", "isbn">;
    fieldOptionsMap.set("isbn", isbnField);
    setConnectionMetadata(fieldOptionsMap);
    const { entityManager, find } = createEntityManager();

    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      { first: 10, query: "isbn:978" },
    ).query();

    expect(find).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      { isbn: "978" },
      expect.objectContaining({ limit: 11 }),
    );
  });

  it("uses findAll when no filter inputs are present", async () => {
    const rows = [
      { id: 1, title: "A", isbn: "1", searchableTitle: "A" },
      { id: 2, title: "B", isbn: "2", searchableTitle: "B" },
    ];
    const { entityManager, find, findAll } = createEntityManager(rows);

    const result = await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      { first: 2, query: "   " },
    ).query();

    expect(find).not.toHaveBeenCalled();
    expect(findAll).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      expect.objectContaining({
        limit: 3,
        orderBy: [{ id: QueryOrder.ASC }],
      }),
    );
    expect(findAll).toHaveBeenNthCalledWith(2, BookEntity, {
      fields: ["id"],
      limit: 10000,
      disableIdentityMap: true,
    });
    expect(result).toEqual({
      totalCount: 2,
      edges: expect.arrayContaining([
        expect.objectContaining({ node: rows[0] }),
        expect.objectContaining({ node: rows[1] }),
      ]),
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: expect.any(String),
        endCursor: expect.any(String),
      },
    });
  });

  it("applies forward cursor filters for ordered queries", async () => {
    const rows = [
      { id: 2, title: "B", isbn: "2", searchableTitle: "B" },
      { id: 3, title: "C", isbn: "3", searchableTitle: "C" },
      { id: 4, title: "D", isbn: "4", searchableTitle: "D" },
    ];
    const { entityManager, find } = createEntityManager(rows);
    const after = new Cursor({ id: 1, value: "A" }).toString();

    const result = await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      {
        first: 2,
        after,
        orderBy: {
          field: "title" as never,
          direction: OrderDirection.ASC,
        },
      },
    ).query();

    expect(find).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      {
        $or: [
          { title: { $gt: "A" } },
          {
            $and: [{ title: { $eq: "A" } }, { id: { $gt: 1 } }],
          },
        ],
      },
      expect.objectContaining({
        limit: 3,
        orderBy: [{ title: QueryOrder.ASC }, { id: QueryOrder.ASC }],
      }),
    );
    expect(result.edges).toHaveLength(2);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
    expect(new Cursor(result.edges[0].cursor).value).toBe("B");
  });

  it("applies backward cursor filters and reverses returned entities", async () => {
    const rows = [
      { id: 4, title: "D", isbn: "4", searchableTitle: "D" },
      { id: 3, title: "C", isbn: "3", searchableTitle: "C" },
      { id: 2, title: "B", isbn: "2", searchableTitle: "B" },
    ];
    const { entityManager, find } = createEntityManager(rows);
    const before = new Cursor({ id: 5, value: "E" }).toString();

    const result = await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      {
        last: 2,
        before,
        orderBy: {
          field: "title" as never,
          direction: OrderDirection.ASC,
        },
      },
    ).query();

    expect(find).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      {
        $or: [
          { title: { $lt: "E" } },
          {
            $and: [{ title: { $eq: "E" } }, { id: { $lt: 5 } }],
          },
        ],
      },
      expect.objectContaining({
        limit: 3,
        orderBy: [{ title: QueryOrder.DESC }, { id: QueryOrder.DESC }],
      }),
    );
    expect(result.edges.map((edge) => edge.node.id)).toEqual([3, 4]);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.hasPreviousPage).toBe(true);
  });

  it("rejects ambiguous pagination arguments", () => {
    const { entityManager } = createEntityManager();

    expect(
      () =>
        new ConnectionQueryBuilder(
          entityManager,
          BookConnection as unknown as ConnectionClass<Book>,
          {
            first: 1,
            before: new Cursor({ id: 1 }).toString(),
          },
        ),
    ).toThrow("paging must use either first/after or last/before");

    expect(
      () =>
        new ConnectionQueryBuilder(
          entityManager,
          BookConnection as unknown as ConnectionClass<Book>,
          {
            first: 1,
            last: 1,
          },
        ),
    ).toThrow("cursor-based pagination cannot be forwards AND backwards");
  });

  it("requires connection metadata", () => {
    class MissingMetadataConnection {}

    expect(
      () =>
        new ConnectionQueryBuilder(
          createEntityManager().entityManager,
          MissingMetadataConnection as unknown as ConnectionClass<Book>,
          { first: 1 },
        ),
    ).toThrow("Connection metadata not found");
  });
});
