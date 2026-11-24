import "reflect-metadata";

import { QueryOrder } from "@mikro-orm/core";
import { type SqlEntityManager } from "@mikro-orm/sql";

import { ConnectionQueryBuilder } from "./connection-query-builder.js";
import { Cursor } from "./cursor.js";
import { OrderDirection } from "./enums/index.js";
import { GRAPHQL_CONNECTION_METADATA } from "./graphql-connection.constants.js";
import type {
  ConnectionFieldOptions,
  ConnectionMetadata,
  FieldOptions,
} from "./interfaces/index.js";
import type { ConnectionClass } from "./types/index.js";
import { createFilter } from "./utils/index.js";

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

/**
 * Returns field options map configured for the test.
 * @returns Field options map configured for the test.
 */
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

/**
 * Registers the connection field metadata used by the test.
 * @param fieldOptionsMap - Field metadata used to build the connection.
 */
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

/**
 * Returns entity manager fixture and its query spies.
 * @param entities - Entity classes registered for the operation.
 * @param nullsLowest - Whether the database sorts nulls before non-null values.
 * @returns Entity manager fixture and its query spies.
 */
function createEntityManager(entities: Book[] = [], nullsLowest = false) {
  const find = vi.fn().mockResolvedValue(entities);
  const findAll = vi.fn().mockResolvedValue(entities);
  const createQueryBuilder = vi.fn();

  return {
    entityManager: {
      createQueryBuilder,
      getPlatform: () => ({ sortsNullsLowest: () => nullsLowest }),
      find,
      findAll,
    } as unknown as SqlEntityManager,
    createQueryBuilder,
    find,
    findAll,
  };
}

describe("ConnectionQueryBuilder", () => {
  beforeEach(() => {
    setConnectionMetadata();
  });

  it.each([
    {
      direction: OrderDirection.ASC,
      value: null,
      expected: {
        $or: [
          { title: { $ne: null } },
          { $and: [{ title: { $eq: null } }, { id: { $gt: 1 } }] },
        ],
      },
    },
    {
      direction: OrderDirection.DESC,
      value: null,
      expected: { $and: [{ title: { $eq: null } }, { id: { $lt: 1 } }] },
    },
    {
      direction: OrderDirection.ASC,
      value: "A",
      expected: {
        $or: [
          { title: { $gt: "A" } },
          { $and: [{ title: { $eq: "A" } }, { id: { $gt: 1 } }] },
        ],
      },
    },
    {
      direction: OrderDirection.DESC,
      value: "A",
      expected: {
        $or: [
          { title: { $lt: "A" } },
          { $and: [{ title: { $eq: "A" } }, { id: { $lt: 1 } }] },
          { title: { $eq: null } },
        ],
      },
    },
  ])(
    "respects nulls-lowest platforms for $direction at $value",
    async ({ direction, value, expected }) => {
      const { entityManager, find } = createEntityManager([], true);
      await new ConnectionQueryBuilder(
        entityManager,
        BookConnection as unknown as ConnectionClass<Book>,
        {
          first: 2,
          after: new Cursor({ id: 1, value }).toString(),
          orderBy: { field: "title", direction },
        },
      ).query();
      expect(find).toHaveBeenCalledWith(
        BookEntity,
        expected,
        expect.any(Object),
      );
    },
  );

  it.each([
    { first: 2, query: null },
    { first: 2, orderBy: null },
    {
      first: 2,
      last: null,
      after: null,
      before: null,
      filter: null,
      query: null,
      orderBy: null,
    },
    { last: 2, first: null, query: null, orderBy: null },
  ])("treats nullable arguments as omitted: %j", async (args) => {
    const book = {
      id: 1,
      title: "Book",
      isbn: "isbn",
      searchableTitle: "Book",
    };
    const { entityManager, findAll } = createEntityManager([book]);
    const result = await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      args,
    ).query();

    expect(result.edges).toEqual([
      { node: book, cursor: new Cursor({ id: 1 }).toString() },
    ]);
    expect(findAll).toHaveBeenCalledWith(BookEntity, {
      limit: 3,
      orderBy: [{ id: args.last === 2 ? QueryOrder.DESC : QueryOrder.ASC }],
    });
  });

  it.each([
    [{ first: 1 }, 2, QueryOrder.ASC],
    [{ last: 1 }, 2, QueryOrder.DESC],
    [{ first: 100 }, 101, QueryOrder.ASC],
    [{ last: 100 }, 101, QueryOrder.DESC],
  ])("accepts boundary page sizes %j", async (args, limit, direction) => {
    const { entityManager, findAll } = createEntityManager();

    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      args,
    ).query();

    expect(findAll).toHaveBeenCalledWith(BookEntity, {
      limit,
      orderBy: [{ id: direction }],
    });
  });

  it.each([-1, 0, 1.5, 101, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid page sizes %s before database access",
    (size) => {
      const { entityManager, find, findAll, createQueryBuilder } =
        createEntityManager();
      for (const args of [
        { first: size },
        { last: size },
        { first: 1, last: size },
      ]) {
        expect(
          () =>
            new ConnectionQueryBuilder(
              entityManager,
              BookConnection as unknown as ConnectionClass<Book>,
              args,
            ),
        ).toThrow("must be an integer between 1 and 100");
      }
      expect(find).not.toHaveBeenCalled();
      expect(findAll).not.toHaveBeenCalled();
      expect(createQueryBuilder).not.toHaveBeenCalled();
    },
  );

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
    expect(find).toHaveBeenCalledTimes(1);
  });

  it.each([
    { query: "title:你好世界" },
    { query: 'title:"你好世界 HELLO!"' },
    { query: "你好世界" },
  ])(
    "automatically tokenizes full-text query syntax: $query",
    async ({ query }) => {
      const { entityManager, find } = createEntityManager();
      await new ConnectionQueryBuilder(
        entityManager,
        BookConnection as unknown as ConnectionClass<Book>,
        { first: 10, query },
      ).query();
      const operand = query.includes("HELLO") ? "你好 世界 hello" : "你好 世界";
      const expected = { searchableTitle: { $fulltext: operand } };
      expect(find).toHaveBeenCalledWith(
        BookEntity,
        expected,
        expect.any(Object),
      );
    },
  );

  it("passes programmatic filters and option constraints unchanged to records and counts", async () => {
    const { entityManager, find } = createEntityManager();
    const filter = { searchableTitle: { $fulltext: "你好世界" } };
    const where = { $or: [{ searchableTitle: { $fulltext: "HELLO!" } }] };
    await new ConnectionQueryBuilder(
      entityManager,
      BookConnection as unknown as ConnectionClass<Book>,
      { first: 10, filter },
      { where },
    ).query();
    const expected = {
      $and: [where, filter],
    };
    expect(find).toHaveBeenCalledWith(BookEntity, expected, expect.any(Object));
    expect(filter.searchableTitle.$fulltext).toBe("你好世界");
    expect(where.$or[0].searchableTitle.$fulltext).toBe("HELLO!");
    expect(find.mock.calls[0]?.[1].$and[0]).toBe(where);
    expect(find.mock.calls[0]?.[1].$and[1]).toBe(filter);
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
    const { createQueryBuilder, entityManager, find, findAll } =
      createEntityManager(rows);

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
    expect(createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toEqual({
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
          { title: { $eq: null } },
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
          { title: { $eq: null } },
        ],
      },
      expect.objectContaining({
        limit: 3,
        orderBy: [{ title: QueryOrder.ASC }, { id: QueryOrder.ASC }],
      }),
    );
  });

  it.each([
    [{}, "Provide exactly one of first or last"],
    [{ first: null, last: null }, "Provide exactly one of first or last"],
    [{ first: 1, last: 1 }, "Provide exactly one of first or last"],
    [{ after: "cursor" }, "Provide exactly one of first or last"],
    [{ before: "cursor" }, "Provide exactly one of first or last"],
    [
      { first: 1, before: "cursor" },
      "Use after with first and before with last",
    ],
    [{ last: 1, after: "cursor" }, "Use after with first and before with last"],
  ])("rejects invalid pagination arguments %o", (args, message) => {
    const { entityManager, find, findAll } = createEntityManager();

    expect(
      () =>
        new ConnectionQueryBuilder(
          entityManager,
          BookConnection as unknown as ConnectionClass<Book>,
          args,
        ),
    ).toThrow(message);
    expect(find).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
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
