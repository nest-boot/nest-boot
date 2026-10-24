import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EntitySchema } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';

import { Migration20261013084102_QueueJobs } from '../src/database/migrations/Migration20261013084102_QueueJobs.js';
import { Migration20261013084103_QueueJobAccess } from '../src/database/migrations/Migration20261013084103_QueueJobAccess.js';
import { createQueueDatabaseFixture } from './postgres.fixture.js';

it('revokes request reads before rolling back Job RLS and restores ownership reads on reapply', async () => {
  const fixture = await createQueueDatabaseFixture();
  const directory = await mkdtemp(join(tmpdir(), 'queue-job-rollback-'));
  const orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    entities: [
      new EntitySchema({
        name: 'HistoricalJob',
        tableName: 'job',
        schema: 'bullmq',
        properties: { id: { type: 'string', primary: true } },
      }),
    ],
    clientUrl: fixture.connectionString,
    extensions: [Migrator],
    migrations: {
      path: directory,
      pathTs: directory,
      snapshotName: '.snapshot-queue-rollback',
      migrationsList: [
        Migration20261013084102_QueueJobs,
        Migration20261013084103_QueueJobAccess,
      ],
    },
  });
  const client = await fixture.pool.connect();
  const readRlsState = async () =>
    (
      await fixture.pool.query(
        "select relrowsecurity from pg_class where oid = 'bullmq.job'::regclass",
      )
    ).rows[0].relrowsecurity;

  try {
    await fixture.pool.query(`
      insert into bullmq.job (queue, id, seq, name, state, data, added_at_ms)
      values
        ('reports', '1', 1, 'report', 'waiting', '{"userId":"alice"}', 0),
        ('reports', '2', 2, 'report', 'waiting', '{"userId":"bob"}', 0);
    `);
    await client.query('set role authenticated');
    await client.query("select set_config('app.user.id', 'alice', false)");

    expect(
      (await orm.migrator.up()).map((migration) => migration.name),
    ).toEqual([
      Migration20261013084102_QueueJobs.name,
      Migration20261013084103_QueueJobAccess.name,
    ]);
    expect(await readRlsState()).toBe(true);
    expect((await client.query('select id from bullmq.job')).rows).toEqual([
      { id: '1' },
    ]);

    expect(
      (await orm.migrator.down()).map((migration) => migration.name),
    ).toEqual([Migration20261013084103_QueueJobAccess.name]);
    expect(await readRlsState()).toBe(true);
    await expect(
      client.query('select id from bullmq.job'),
    ).rejects.toMatchObject({
      code: '42501',
    });
    expect(
      (await orm.migrator.down()).map((migration) => migration.name),
    ).toEqual([Migration20261013084102_QueueJobs.name]);
    expect(await readRlsState()).toBe(false);
    await expect(
      client.query('select id from bullmq.job'),
    ).rejects.toMatchObject({
      code: '42501',
    });
    expect(
      (await fixture.pool.query('select id from bullmq.job order by id')).rows,
    ).toEqual([{ id: '1' }, { id: '2' }]);

    await orm.migrator.up();
    expect((await client.query('select id from bullmq.job')).rows).toEqual([
      { id: '1' },
    ]);
  } finally {
    client.release();
    await orm.close(true);
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
