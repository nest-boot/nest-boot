import { EntityManager, EntitySchema, MikroORM } from '@mikro-orm/core';
import { PgliteDriver } from '@mikro-orm/pglite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { SqlEntityManager } from '@mikro-orm/sql';
import {
  ConnectionBuilder,
  ConnectionManager,
  GraphQLConnectionModule,
} from '@nest-boot/graphql-connection';
import { MikroOrmModule } from '@nest-boot/mikro-orm';
import { Test } from '@nestjs/testing';

class ConnectionBook {
  id!: number;
  title!: string;
}

const BookSchema = new EntitySchema({
  class: ConnectionBook,
  properties: {
    id: { type: 'number', primary: true },
    title: { type: 'string' },
  },
});

describe('GraphQL connection and official SQL driver integration', () => {
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
