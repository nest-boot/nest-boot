import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Migrator } from '@mikro-orm/migrations';
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

it('preserves the edited RLS rollback on repeated migration creation', async () => {
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
    // Match the example migration's fail-closed rollback instead of the
    // generated rollback that disables RLS.
    const original = (await readFile(file, 'utf8')).replace(
      'alter table "bullmq"."job" disable row level security;',
      'alter table "bullmq"."job" enable row level security;',
    );
    expect(original).not.toContain('disable row level security');
    await writeFile(file, original);
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
