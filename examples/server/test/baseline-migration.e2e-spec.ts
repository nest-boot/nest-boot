import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { entities as authEntities, workspaceEntities } from '@nest-boot/auth';
import { JobEntity } from '@nest-boot/queue-api';

import { Migration00000000000000_Initial } from '../src/database/migrations/Migration00000000000000_Initial.js';
import { createDatabaseFixture } from './postgres.fixture.js';

it('builds the current example schema from ordered migrations and can roll back and rebuild it', async () => {
  const fixture = await createDatabaseFixture();
  const orm = await MikroORM.init({
    clientUrl: fixture.connectionString,
    entities: [...authEntities, ...workspaceEntities, JobEntity],
    metadataProvider: TsMorphMetadataProvider,
    metadataCache: { enabled: false },
    extensions: [Migrator],
    migrations: {
      path: './src/database/migrations',
      pathTs: './src/database/migrations',
      snapshotName: '.snapshot-postgres',
      snapshotOnMigrate: false,
    },
  });
  try {
    const migrated = await orm.migrator.up();
    expect(migrated).toHaveLength(2);
    expect(migrated[0].name).toBe(Migration00000000000000_Initial.name);
    const columns = await fixture.pool.query(
      "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'api_key' and column_name in ('enabled', 'revoked_at') order by column_name",
    );
    expect(columns.rows).toEqual([
      {
        column_name: 'revoked_at',
        data_type: 'timestamp with time zone',
        is_nullable: 'YES',
      },
    ]);
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
    expect(await orm.migrator.checkSchema()).toBe(false);

    const { rows } = await fixture.pool.query(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    expect(rows.map(({ tablename }) => tablename)).toEqual([
      'account',
      'api_key',
      'job',
      'mikro_orm_migrations',
      'session',
      'system_account',
      'user',
      'verification',
      'workspace',
      'workspace_invitation',
      'workspace_member',
    ]);
    expect(
      (
        await fixture.pool.query(
          "select schema_name from information_schema.schemata where schema_name in ('bullmq', 'queue_legacy', 'queue_postgres_legacy')",
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await fixture.pool.query(
          "select relrowsecurity from pg_class where oid = 'public.job'::regclass",
        )
      ).rows,
    ).toEqual([{ relrowsecurity: false }]);
    const inserted = await fixture.pool.query(
      "insert into job (queue, job_id, name, status, created_at) values ('email', '1', 'send', 'waiting', now()) returning id, last_event_ms, last_event_seq",
    );
    expect(inserted.rows[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      last_event_ms: '0',
      last_event_seq: '0',
    });

    await orm.migrator.down({ to: 0 });
    expect(await orm.migrator.getExecuted()).toEqual([]);
    expect(
      (await fixture.pool.query("select to_regclass('public.job') as job"))
        .rows,
    ).toEqual([{ job: null }]);
    expect(
      (
        await fixture.pool.query(
          "select extname from pg_extension where extname in ('uuid-ossp', 'pgcrypto') order by extname",
        )
      ).rows.map(({ extname }) => extname),
    ).toEqual(['pgcrypto', 'uuid-ossp']);

    expect(await orm.migrator.up()).toHaveLength(2);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
    expect(await orm.migrator.checkSchema()).toBe(false);
  } finally {
    await orm.close();
    await fixture.close();
  }
}, 30000);
