import "reflect-metadata";

import { QueryOrder } from "@mikro-orm/core";
import { type SqlEntityManager } from "@mikro-orm/knex";

import { ConnectionQueryBuilder } from "./connection-query-builder";
import { Cursor } from "./cursor";
import { OrderDirection, TotalCountRelation } from "./enums";
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

function createEntityManager(
  entities: Book[] = [],
  totalCount: number = entities.length,
) {
  const find = jest.fn().mockResolvedValue(entities);
  const findAll = jest.fn().mockResolvedValue(entities);
  const limitedCountQueryBuilder = {
    applyFilters: jest.fn().mockResolvedValue(undefined),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    withSchema: jest.fn().mockReturnThis(),
  };
  const countQueryBuilder = {
    count: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(totalCount),
  };
  const createQueryBuilder = jest
    .fn()
    .mockReturnValueOnce(limitedCountQueryBuilder)
    .mockReturnValueOnce(countQueryBuilder);

  return {
    entityManager: {
      createQueryBuilder,
      find,
      findAll,
    } as unknown as SqlEntityManager,
    countQueryBuilder,
    createQueryBuilder,
    find,
    findAll,
    limitedCountQueryBuilder,
  };
}

describe("ConnectionQueryBuilder", () => {
  beforeEach(() => {
    setConnectionMetadata();
  });

  it("maps query string fulltext searches to a configured fulltext field path", async () => {
    const { entityManager, find, limitedCountQueryBuilder } =
      createEntityManager();

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
    expect(find).toHaveBeenCalledTimes(1);
    expect(limitedCountQueryBuilder.where).toHaveBeenCalledWith({
      searchableTitle: { $fulltext: "search" },
    });
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
    const {
      countQueryBuilder,
      createQueryBuilder,
      entityManager,
      find,
      findAll,
      limitedCountQueryBuilder,
    } = createEntityManager(rows);

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
    expect(findAll).toHaveBeenCalledTimes(1);
    expect(createQueryBuilder).toHaveBeenNthCalledWith(1, BookEntity);
    expect(limitedCountQueryBuilder.select).toHaveBeenCalledWith("id");
    expect(limitedCountQueryBuilder.limit).toHaveBeenCalledWith(10001);
    expect(limitedCountQueryBuilder.where).not.toHaveBeenCalled();
    expect(limitedCountQueryBuilder.applyFilters).toHaveBeenCalledWith(
      undefined,
    );
    expect(createQueryBuilder).toHaveBeenNthCalledWith(
      2,
      limitedCountQueryBuilder,
      "bounded_count",
    );
    expect(countQueryBuilder.count).toHaveBeenCalledTimes(1);
    expect(countQueryBuilder.getCount).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalCount: 2,
      totalCountRelation: TotalCountRelation.EQ,
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

  it.each([
    [10000, TotalCountRelation.EQ],
    [10001, TotalCountRelation.GTE],
  ])(
    "reports the total count relation for %i matching entities",
    async (matchingCount, expectedRelation) => {
      const rows = [{ id: 1, title: "A", isbn: "1", searchableTitle: "A" }];
      const { entityManager, findAll, limitedCountQueryBuilder } =
        createEntityManager(rows, matchingCount);

      const result = await new ConnectionQueryBuilder(
        entityManager,
        BookConnection as unknown as ConnectionClass<Book>,
        { first: 1 },
      ).query();

      expect(result.totalCount).toBe(Math.min(matchingCount, 10000));
      expect(result.totalCountRelation).toBe(expectedRelation);
      expect(findAll).toHaveBeenCalledTimes(1);
      expect(limitedCountQueryBuilder.limit).toHaveBeenCalledWith(10001);
    },
  );

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

  it("uses descending ID tie-break filters for forward descending queries", async () => {
    const { entityManager, find } = createEntityManager();
    const after = new Cursor({ id: 10, value: "A" }).toString();

    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      {
        first: 2,
        after,
        orderBy: {
          field: "title" as never,
          direction: OrderDirection.DESC,
        },
      },
    ).query();

    expect(find).toHaveBeenNthCalledWith(
      1,
      BookEntity,
      {
        $or: [
          { title: { $lt: "A" } },
          {
            $and: [{ title: { $eq: "A" } }, { id: { $lt: 10 } }],
          },
        ],
      },
      expect.objectContaining({
        limit: 3,
        orderBy: [{ title: QueryOrder.DESC }, { id: QueryOrder.DESC }],
      }),
    );
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

  it("uses ascending ID tie-break filters for backward descending queries", async () => {
    const { entityManager, find } = createEntityManager();
    const before = new Cursor({ id: 10, value: "A" }).toString();

    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      {
        last: 2,
        before,
        orderBy: {
          field: "title" as never,
          direction: OrderDirection.DESC,
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
            $and: [{ title: { $eq: "A" } }, { id: { $gt: 10 } }],
          },
        ],
      },
      expect.objectContaining({
        limit: 3,
        orderBy: [{ title: QueryOrder.ASC }, { id: QueryOrder.ASC }],
      }),
    );
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
