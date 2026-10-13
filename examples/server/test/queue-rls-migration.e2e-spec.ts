import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Migrator } from '@mikro-orm/migrations';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { withQueueDatabaseConfig } from '@nest-boot/queue';

import { Migration20261013084102_QueueJobs } from '../src/database/migrations/Migration20261013084102_QueueJobs.js';
import { Migration20261013084103_QueueJobAccess } from '../src/database/migrations/Migration20261013084103_QueueJobAccess.js';
import { createQueueDatabaseFixture } from './postgres.fixture.js';

it('revokes request reads before rolling back Job RLS and restores ownership reads on reapply', async () => {
  const fixture = await createQueueDatabaseFixture();
  const directory = await mkdtemp(join(tmpdir(), 'queue-job-rollback-'));
  const orm = await MikroORM.init(
    withQueueDatabaseConfig({
      driver: PostgreSqlDriver,
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
    }),
  );
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
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
    expect((await orm.migrator.create()).fileName).toBe('');

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
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
    expect((await orm.migrator.create()).fileName).toBe('');
  } finally {
    client.release();
    await orm.close(true);
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);

it('preserves the generated RLS migration on repeated migration creation', async () => {
  const fixture = await createQueueDatabaseFixture();
  const directory = await mkdtemp(join(tmpdir(), 'queue-rls-migrations-'));
  const orm = await MikroORM.init(
    withQueueDatabaseConfig({
      driver: PostgreSqlDriver,
      clientUrl: fixture.connectionString,
      extensions: [Migrator],
      migrations: {
        path: directory,
        pathTs: directory,
        emit: 'js' as const,
        snapshot: true,
        snapshotName: '.snapshot-queue-rls',
      },
    }),
  );
  try {
    const generated = await orm.migrator.create();
    expect(generated.code).toContain(
      'alter table "bullmq"."job" disable row level security;',
    );
    const file = join(directory, generated.fileName);
    const original = await readFile(file, 'utf8');
    await orm.schema.execute(generated.diff.up.join('\n'));

    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await orm.migrator.create()).fileName).toBe('');
      expect(await readFile(file, 'utf8')).toBe(original);
    }

    await orm.schema.execute(
      'alter table "bullmq"."job" disable row level security;',
    );
    expect((await orm.schema.getUpdateSchemaSQL({ wrap: false })).trim()).toBe(
      'alter table "bullmq"."job" enable row level security;',
    );
    // A committed snapshot tracks the desired schema, rather than this
    // manual database change; repeated migration creation leaves it intact.
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await orm.migrator.create()).fileName).toBe('');
      expect(await readFile(file, 'utf8')).toBe(original);
    }
    expect(await readdir(directory)).toEqual(
      expect.arrayContaining([generated.fileName, '.snapshot-queue-rls.json']),
    );
    expect(await readdir(directory)).toHaveLength(2);
    await orm.schema.update();
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  } finally {
    await orm.close(true);
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
