import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { entities as authEntities, workspaceEntities } from '@nest-boot/auth';
import { JobEntity } from '@nest-boot/queue-api';

import { Migration00000000000000_Initial } from '../src/database/migrations/Migration00000000000000_Initial.js';
import { Migration20261123155228_Schema } from '../src/database/migrations/Migration20261123155228_Schema.js';
import { createDatabaseFixture } from './postgres.fixture.js';

it('builds the current example schema from ordered migrations and can roll back and rebuild it', async () => {
  const fixture = await createDatabaseFixture();
  const options = {
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
  };
  const orm = await MikroORM.init(options);
  try {
    expect((await orm.migrator.up()).map(({ name }) => name)).toEqual([
      Migration00000000000000_Initial.name,
      Migration20261123155228_Schema.name,
    ]);
    const identifiers = await fixture.pool.query(`
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (('user', 'username'), ('workspace', 'slug'))
      order by table_name
    `);
    expect(identifiers.rows).toEqual([
      {
        table_name: 'user',
        column_name: 'username',
        data_type: 'text',
        is_nullable: 'YES',
      },
      {
        table_name: 'workspace',
        column_name: 'slug',
        data_type: 'text',
        is_nullable: 'NO',
      },
    ]);
    const checks = await fixture.pool.query(`
      select conname from pg_constraint
      where contype = 'c'
        and conrelid in ('public.user'::regclass, 'public.workspace'::regclass)
      order by conname
    `);
    expect(checks.rows).toEqual([
      { conname: 'user_username_check' },
      { conname: 'workspace_slug_check' },
    ]);
    const unassignedUsers = await fixture.pool.query(
      "insert into \"user\" (name, email, email_verified, roles, permissions) values ('No handle', 'first-unassigned@example.test', true, array['user'], array[]::text[]), ('No handle', 'second-unassigned@example.test', true, array['user'], array[]::text[]) returning username",
    );
    expect(unassignedUsers.rows).toEqual([
      { username: null },
      { username: null },
    ]);
    // Bypass all application validation to verify the database boundary itself.
    for (const [table, column, constraint] of [
      ['user', 'username', 'user_username_check'],
      ['workspace', 'slug', 'workspace_slug_check'],
    ] as const) {
      const insert = (value: string) =>
        table === 'user'
          ? fixture.pool.query(
              'insert into "user" (name, username, email, email_verified, roles, permissions) values ($1, $2, $3, true, array[\'user\'], array[]::text[]) returning id',
              ['Check fixture', value, `${table}-${value}@example.test`],
            )
          : fixture.pool.query(
              'insert into workspace (name, slug) values ($1, $2) returning id',
              ['Check fixture', value],
            );
      for (const value of ['abc', 'a-2', 'z'.repeat(30)]) {
        await expect(insert(value)).resolves.toHaveProperty('rowCount', 1);
      }
      const target = await insert('check-update');
      for (const value of [
        '',
        'ab',
        'a'.repeat(31),
        '0user',
        'Alice',
        '-alice',
        'alice-',
        'alice--team',
        'alice_team',
        'alice/team',
        ' alice',
        'alice ',
        'alice\n',
        'alice\r',
        'Kelvin',
        'équipe',
        'ａｌｉｃｅ',
      ]) {
        await expect(insert(value)).rejects.toMatchObject({
          code: '23514',
          constraint,
        });
        await expect(
          fixture.pool.query(
            `update "${table}" set "${column}" = $1 where id = $2`,
            [value, target.rows[0].id],
          ),
        ).rejects.toMatchObject({ code: '23514', constraint });
      }
    }
    const listed = await MikroORM.init({
      ...options,
      migrations: {
        ...options.migrations,
        migrationsList: [
          Migration00000000000000_Initial,
          Migration20261123155228_Schema,
        ],
      },
    });
    try {
      expect(await listed.migrator.getPending()).toEqual([]);
      expect(await listed.migrator.up()).toEqual([]);
    } finally {
      await listed.close();
    }
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
}, 30_000);
