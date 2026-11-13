import { EntityManager, EntitySchema, MikroORM, raw } from "@mikro-orm/core";
import { PgliteDriver } from "@mikro-orm/pglite";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { FullTextType, SqlEntityManager } from "@mikro-orm/sql";
import {
  DatabaseModule,
  onFullTextCreate,
  onFullTextUpdate,
} from "@nest-boot/database";
import { Test } from "@nestjs/testing";

import {
  ConnectionBuilder,
  ConnectionManager,
  GraphQLConnectionModule,
  OrderDirection,
} from "../src/index.js";

class ConnectionBook {
  id!: number;
  title!: string;
  lastUsedAt!: Date | null;
}

const BookSchema = new EntitySchema({
  class: ConnectionBook,
  properties: {
    id: { type: "number", primary: true },
    title: { type: "string" },
    lastUsedAt: { type: "Date", nullable: true },
  },
});

class SearchableConnectionBook {
  id!: number;
  title!: string;
  searchableTitle!: string | null;
}

const SearchableBookSchema = new EntitySchema({
  class: SearchableConnectionBook,
  properties: {
    id: { type: "number", primary: true },
    title: { type: "string" },
    searchableTitle: {
      type: FullTextType,
      nullable: true,
      onCreate: onFullTextCreate("title"),
      onUpdate: onFullTextUpdate("title"),
    },
  },
});

describe("GraphQL connection and official SQL driver integration", () => {
  it("uses matching full-text boundaries for query syntax and schema filters while preserving native conditions", async () => {
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      entities: [SearchableBookSchema],
      dbName: "memory://",
    });
    try {
      await orm.schema.create();
      const em = orm.em.fork();
      em.create(SearchableConnectionBook, { id: 1, title: "你好世界 HELLO" });
      em.create(SearchableConnectionBook, { id: 2, title: "你好上海 HELLO" });
      em.create(SearchableConnectionBook, { id: 3, title: "Goodbye 世界" });
      await em.flush();
      const { Connection, Filter } = new ConnectionBuilder(
        SearchableConnectionBook,
      )
        .addField({
          field: "title",
          type: "string",
          filterable: true,
          searchable: true,
          fulltext: "searchableTitle",
        })
        .build();
      const manager = new ConnectionManager(em);
      const queried = await manager.find(Connection, {
        first: 10,
        query: "你好世界",
      });
      expect(queried.edges.map(({ node }) => node.id)).toEqual([1]);
      expect(queried.totalCount).toBe(1);

      const filtered = await manager.find(Connection, {
        first: 10,
        filter: Filter.parseValue({ title: { $fulltext: "你好世界, HELLO!" } }),
      });
      expect(filtered.edges.map(({ node }) => node.id)).toEqual([1]);
      expect(filtered.totalCount).toBe(1);

      const constrained = await manager.find(Connection, {
        first: 10,
        filter: Filter.parseValue({
          $or: [
            { title: { $fulltext: "你好上海" } },
            { title: { $fulltext: "GOODBYE" } },
          ],
        }),
      });
      expect(constrained.edges.map(({ node }) => node.id)).toEqual([2, 3]);
      expect(constrained.totalCount).toBe(2);

      for (const [text, expectedIds] of [
        ["你好世界", []],
        ["你好 世界", [1]],
      ] as const) {
        const native = await manager.find(
          Connection,
          { first: 10 },
          {
            where: { searchableTitle: { $fulltext: text } },
          },
        );
        expect(native.edges.map(({ node }) => node.id)).toEqual(expectedIds);
        expect(native.totalCount).toBe(expectedIds.length);
      }

      const combined = await manager.find(
        Connection,
        {
          first: 10,
          query: "title:你好世界",
          filter: Filter.parseValue({ title: { $fulltext: "HELLO!" } }),
        },
        { where: { title: { $eq: "你好世界 HELLO" } } },
      );
      expect(combined.edges.map(({ node }) => node.id)).toEqual([1]);
      expect(combined.totalCount).toBe(1);

      for (const query of [undefined, "HELLO!"]) {
        const scoped = await manager.find(
          Connection,
          { first: 10, query },
          {
            where: {
              $and: [
                { [raw((alias) => `${alias}."id"`)]: { $lte: 1 } },
                { title: { $ne: "Unpublished" } },
              ],
            },
          },
        );
        expect(scoped.edges.map(({ node }) => node.id)).toEqual([1]);
        expect(scoped.totalCount).toBe(1);
      }

      const empty = await manager.find(Connection, {
        first: 10,
        filter: Filter.parseValue({ title: { $fulltext: "!!!" } }),
      });
      expect(empty.edges).toEqual([]);
      expect(empty.totalCount).toBe(0);
    } finally {
      await orm.close(true);
    }
  });

  it.each([
    { direction: OrderDirection.ASC, backward: false },
    { direction: OrderDirection.ASC, backward: true },
    { direction: OrderDirection.DESC, backward: false },
    { direction: OrderDirection.DESC, backward: true },
  ])(
    "paginates null sort values with $direction (backward: $backward)",
    async ({ direction, backward }) => {
      const orm = await MikroORM.init({
        driver: PgliteDriver,
        entities: [BookSchema],
        dbName: "memory://",
      });
      try {
        await orm.schema.create();
        const em = orm.em.fork();
        await em.insertMany(ConnectionBook, [
          { id: 1, title: "First", lastUsedAt: new Date("2026-01-01") },
          { id: 2, title: "Unused", lastUsedAt: null },
          { id: 3, title: "Same date", lastUsedAt: new Date("2026-01-01") },
          { id: 4, title: "Later", lastUsedAt: new Date("2026-01-02") },
          { id: 5, title: "Also unused", lastUsedAt: null },
        ]);
        const { Connection } = new ConnectionBuilder(ConnectionBook)
          .addField({ field: "lastUsedAt", type: "date", sortable: true })
          .build();
        const manager = new ConnectionManager(em);
        const ids: number[] = [];
        let cursor: string | null | undefined;
        let hasMore = true;
        for (let page = 0; hasMore && page < 6; page++) {
          const result = await manager.find(Connection, {
            ...(backward
              ? { last: 1, before: cursor }
              : { first: 1, after: cursor }),
            // GraphQL resolves order enums to their entity property paths.
            orderBy: { field: "lastUsedAt", direction },
          });
          expect(result.totalCount).toBe(5);
          expect(result.edges).toHaveLength(1);
          const pageIds = result.edges.map(({ node }) => node.id);
          if (backward) {
            ids.unshift(...pageIds);
          } else {
            ids.push(...pageIds);
          }
          cursor = backward
            ? result.pageInfo.startCursor
            : result.pageInfo.endCursor;
          hasMore = backward
            ? result.pageInfo.hasPreviousPage
            : result.pageInfo.hasNextPage;
        }
        expect(hasMore).toBe(false);
        expect(ids).toEqual(
          direction === OrderDirection.ASC ? [1, 3, 4, 2, 5] : [5, 2, 4, 3, 1],
        );
      } finally {
        await orm.close(true);
      }
    },
  );

  it.each([{ driver: PostgreSqlDriver }, { driver: PgliteDriver }])(
    "resolves ConnectionManager with $driver.name without a SqlEntityManager alias",
    async ({ driver }) => {
      const module = await Test.createTestingModule({
        imports: [
          DatabaseModule.forRoot({
            driver,
            dbName: "connection_manager_di_test",
            entities: [BookSchema],
          }),
          GraphQLConnectionModule,
        ],
      }).compile();

      try {
        await module.init();
        expect(module.get(ConnectionManager)).toBeInstanceOf(ConnectionManager);
        expect(module.get(EntityManager)).toBe(module.get(MikroORM).em);
        expect(() => module.get(SqlEntityManager)).toThrow();
      } finally {
        await module.close();
      }
    },
  );

  it("executes paginated queries through the injected PGlite entity manager", async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [BookSchema],
          allowGlobalContext: true,
        }),
        GraphQLConnectionModule,
      ],
    }).compile();

    try {
      await module.init();
      const orm = module.get(MikroORM<PgliteDriver>);
      await orm.schema.create();
      await orm.em.insertMany(ConnectionBook, [
        { id: 1, title: "First" },
        { id: 2, title: "Second" },
      ]);
      const { Connection } = new ConnectionBuilder(ConnectionBook).build();
      const result = await module.get(ConnectionManager).find(Connection, {
        first: 1,
      });

      expect(result.totalCount).toBe(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node).toMatchObject({ id: 1, title: "First" });
      expect(result.pageInfo.hasNextPage).toBe(true);
    } finally {
      await module.close();
    }
  });
});
