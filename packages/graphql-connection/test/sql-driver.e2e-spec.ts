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
  CountPrecision,
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

class Edition {
  id!: number;
  published!: boolean;
}

const EditionSchema = new EntitySchema({
  class: Edition,
  properties: {
    id: { type: "number", primary: true },
    published: { type: "boolean" },
  },
});

class Volume {
  id!: number;
  edition!: Edition;
}

const VolumeSchema = new EntitySchema({
  class: Volume,
  properties: {
    id: { type: "number", primary: true },
    edition: { kind: "m:1", entity: () => Edition },
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
  it("counts the same matches as a list when an ORM filter reads the query schema", async () => {
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      entities: [BookSchema],
      dbName: "memory://",
    });
    try {
      await orm.schema.create();
      const em = orm.em.fork({ schema: "public" });
      await em.insertMany(ConnectionBook, [
        { id: 1, title: "Standard" },
        { id: 2, title: "Annotated" },
        { id: 3, title: "Annotated" },
      ]);
      em.addFilter({
        name: "edition",
        entity: ConnectionBook,
        args: false,
        cond: (_args, _type, _em, options) => ({
          title: options?.schema === "public" ? "Standard" : "Annotated",
        }),
      });
      const { Connection } = new ConnectionBuilder(ConnectionBook).build();
      const manager = new ConnectionManager(em);

      for (const scope of [{ schema: "public" }, {}]) {
        const page = await manager.find(Connection, { first: 10 }, scope);
        expect(page.edges.map(({ node }) => node.id)).toEqual([1]);
        await expect(manager.count(Connection, {}, scope)).resolves.toEqual({
          count: 1,
          precision: CountPrecision.EXACT,
        });
      }
      await expect(
        manager.count(Connection, {}, { filters: false }),
      ).resolves.toEqual({ count: 3, precision: CountPrecision.EXACT });
      const zeroId = { where: 0, filters: false } as const;
      await expect(
        manager.find(Connection, { first: 10 }, zeroId),
      ).resolves.toMatchObject({ edges: [] });
      await expect(manager.count(Connection, {}, zeroId)).resolves.toEqual({
        count: 0,
        precision: CountPrecision.EXACT,
      });
    } finally {
      await orm.close(true);
    }
  });

  it("distinguishes an exact count of 10,000 from a lower bound", async () => {
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      entities: [BookSchema],
      dbName: "memory://",
    });
    try {
      await orm.schema.create();
      const em = orm.em.fork();
      await em.execute(
        'insert into "connection_book" ("id", "title") select id, \'Book\' from generate_series(1, 10001) as ids(id)',
      );
      const { Connection } = new ConnectionBuilder(ConnectionBook).build();
      const manager = new ConnectionManager(em);

      const execute = vi.spyOn(em.getConnection(), "execute");
      await expect(manager.count(Connection, {})).resolves.toEqual({
        count: 10_000,
        precision: CountPrecision.AT_LEAST,
      });
      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0].slice(0, 2)).toEqual([
        expect.stringMatching(
          /select count\(\*\).*from \(select .* limit \?\)/i,
        ),
        [10_001],
      ]);
      await expect(
        manager.count(Connection, {}, { where: { id: { $lte: 10_000 } } }),
      ).resolves.toEqual({ count: 10_000, precision: CountPrecision.EXACT });
      await expect(
        manager.count(Connection, {}, { where: { id: { $lt: 0 } } }),
      ).resolves.toEqual({ count: 0, precision: CountPrecision.EXACT });
    } finally {
      await orm.close(true);
    }
  });

  it("counts the same volumes when MikroORM implicitly filters their editions", async () => {
    const orm = await MikroORM.init({
      driver: PgliteDriver,
      entities: [VolumeSchema, EditionSchema],
      dbName: "memory://",
    });
    try {
      await orm.schema.create();
      const em = orm.em.fork();
      await em.insertMany(Edition, [
        { id: 1, published: true },
        { id: 2, published: false },
      ]);
      await em.insertMany(Volume, [
        { id: 1, edition: 1 },
        { id: 2, edition: 1 },
        { id: 3, edition: 2 },
      ]);
      em.addFilter({
        name: "published",
        entity: Edition,
        cond: { published: true },
      });
      const { Connection } = new ConnectionBuilder(Volume).build();
      const manager = new ConnectionManager(em);
      const page = await manager.find(Connection, { first: 1 });

      expect(page.edges.map(({ node }) => node.id)).toEqual([1]);
      expect(page.pageInfo.hasNextPage).toBe(true);
      await expect(manager.count(Connection, {})).resolves.toEqual({
        count: 2,
        precision: CountPrecision.EXACT,
      });
      await expect(
        manager.count(Connection, {}, { filters: false }),
      ).resolves.toEqual({ count: 3, precision: CountPrecision.EXACT });
    } finally {
      await orm.close(true);
    }
  });

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

      const filtered = await manager.find(Connection, {
        first: 10,
        filter: Filter.parseValue({ title: { $fulltext: "你好世界, HELLO!" } }),
      });
      expect(filtered.edges.map(({ node }) => node.id)).toEqual([1]);

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
      }

      const search = {
        query: "title:你好世界",
        filter: Filter.parseValue({ title: { $fulltext: "HELLO!" } }),
      };
      const scope = { where: { title: { $eq: "你好世界 HELLO" } } };
      const combined = await manager.find(
        Connection,
        { first: 10, ...search },
        scope,
      );
      expect(combined.edges.map(({ node }) => node.id)).toEqual([1]);
      expect(await manager.count(Connection, search, scope)).toEqual({
        count: 1,
        precision: "EXACT",
      });

      for (const query of [undefined, "HELLO!"]) {
        const scope = {
          where: {
            $and: [
              { [raw((alias) => `${alias}."id"`)]: { $lte: 1 } },
              { title: { $ne: "Unpublished" } },
            ],
          },
        };
        const scoped = await manager.find(
          Connection,
          { first: 10, query },
          scope,
        );
        expect(scoped.edges.map(({ node }) => node.id)).toEqual([1]);
        expect((await manager.count(Connection, { query }, scope)).count).toBe(
          1,
        );
      }

      const empty = await manager.find(Connection, {
        first: 10,
        filter: Filter.parseValue({ title: { $fulltext: "!!!" } }),
      });
      expect(empty.edges).toEqual([]);
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

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node).toMatchObject({ id: 1, title: "First" });
      expect(result.pageInfo.hasNextPage).toBe(true);
    } finally {
      await module.close();
    }
  });
});
