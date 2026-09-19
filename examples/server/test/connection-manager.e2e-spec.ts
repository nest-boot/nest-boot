import { EntityManager, EntitySchema, MikroORM } from '@mikro-orm/core';
import { PgliteDriver } from '@mikro-orm/pglite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SqlEntityManager } from '@mikro-orm/sql';
import {
  ConnectionBuilder,
  ConnectionManager,
  GraphQLConnectionModule,
  OrderDirection,
} from '@nest-boot/graphql-connection';
import { MikroOrmModule } from '@nest-boot/mikro-orm';
import { Test } from '@nestjs/testing';

class ConnectionBook {
  id!: number;
  title!: string;
  lastUsedAt!: Date | null;
}

const BookSchema = new EntitySchema({
  class: ConnectionBook,
  properties: {
    id: { type: 'number', primary: true },
    title: { type: 'string' },
    lastUsedAt: { type: 'Date', nullable: true },
  },
});

describe('GraphQL connection and official SQL driver integration', () => {
  it.each([
    { direction: OrderDirection.ASC, backward: false },
    { direction: OrderDirection.ASC, backward: true },
    { direction: OrderDirection.DESC, backward: false },
    { direction: OrderDirection.DESC, backward: true },
  ])(
    'paginates null sort values with $direction (backward: $backward)',
    async ({ direction, backward }) => {
      const orm = await MikroORM.init({
        driver: PgliteDriver,
        entities: [BookSchema],
        dbName: 'memory://',
      });
      try {
        await orm.schema.create();
        const em = orm.em.fork();
        await em.insertMany(ConnectionBook, [
          { id: 1, title: 'First', lastUsedAt: new Date('2026-01-01') },
          { id: 2, title: 'Unused', lastUsedAt: null },
          { id: 3, title: 'Same date', lastUsedAt: new Date('2026-01-01') },
          { id: 4, title: 'Later', lastUsedAt: new Date('2026-01-02') },
          { id: 5, title: 'Also unused', lastUsedAt: null },
        ]);
        const { Connection } = new ConnectionBuilder(ConnectionBook)
          .addField({ field: 'lastUsedAt', type: 'date', sortable: true })
          .build();
        const manager = new ConnectionManager(em);
        const ids: number[] = [];
        let cursor: string | undefined;
        let hasMore = true;
        for (let page = 0; hasMore && page < 6; page++) {
          const result = await manager.find(Connection, {
            ...(backward
              ? { last: 1, before: cursor }
              : { first: 1, after: cursor }),
            // GraphQL resolves order enums to their entity property paths.
            orderBy: { field: 'lastUsedAt' as never, direction },
          });
          expect(result.totalCount).toBe(5);
          expect(result.edges).toHaveLength(1);
          const pageIds = result.edges.map(({ node }) => node.id);
          if (backward) ids.unshift(...pageIds);
          else ids.push(...pageIds);
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
    'resolves ConnectionManager with $driver.name without a SqlEntityManager alias',
    async ({ driver }) => {
      const module = await Test.createTestingModule({
        imports: [
          MikroOrmModule.forRoot({
            driver,
            dbName: 'connection_manager_di_test',
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

  it('executes paginated queries through the injected PGlite entity manager', async () => {
    const module = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot({
          driver: PgliteDriver,
          dbName: 'memory://',
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
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' },
      ]);
      const { Connection } = new ConnectionBuilder(ConnectionBook).build();
      const result = await module.get(ConnectionManager).find(Connection, {
        first: 1,
      });

      expect(result.totalCount).toBe(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node).toMatchObject({ id: 1, title: 'First' });
      expect(result.pageInfo.hasNextPage).toBe(true);
    } finally {
      await module.close();
    }
  });
});
