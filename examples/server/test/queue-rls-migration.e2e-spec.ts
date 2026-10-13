import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { withQueueDatabaseConfig } from '@nest-boot/queue';

import { Migration20261011164129_JobRls } from '../src/database/migrations/Migration20261011164129_JobRls.js';
import { createQueueDatabaseFixture } from './postgres.fixture.js';

it('denies request-role job reads during rollback and restores ownership reads on reapply', async () => {
  const fixture = await createQueueDatabaseFixture();
  const orm = await MikroORM.init(
    withQueueDatabaseConfig({
      driver: PostgreSqlDriver,
      clientUrl: fixture.connectionString,
    }),
  );
  const client = await fixture.pool.connect();
  const migration = new Migration20261011164129_JobRls(
    orm.em.getDriver(),
    orm.config,
  );

    /**
     * Executes the actual application's migration queries as the table owner.
     * @param direction - Migration operation.
     */
    async function apply(direction: 'up' | 'down') {
    migration.reset();
    await migration[direction]();
    for (const sql of migration.getQueries()) {
      if (typeof sql !== 'string')
        throw new Error('Expected SQL migration query');
      await fixture.pool.query(sql);
    }
  }

  try {
    await fixture.pool.query(`
      grant usage on schema bullmq to authenticated;
      grant select on bullmq.job to authenticated;
      insert into bullmq.job (queue, id, seq, name, state, data, added_at_ms)
      values ('reports', '1', 1, 'report', 'waiting', '{"userId":"alice"}', 0);
    `);
    await client.query('set role authenticated');
    await client.query("select set_config('app.user.id', 'alice', false)");

    await apply('up');
    expect((await client.query('select id from bullmq.job')).rows).toEqual([
      { id: '1' },
    ]);
    await apply('down');
    expect((await client.query('select id from bullmq.job')).rows).toEqual([]);
    expect(
      (await fixture.pool.query('select id from bullmq.job')).rows,
    ).toEqual([{ id: '1' }]);
    await apply('up');
    expect((await client.query('select id from bullmq.job')).rows).toEqual([
      { id: '1' },
    ]);
  } finally {
    client.release();
    await orm.close(true);
    await fixture.close();
  }
}, 20_000);
