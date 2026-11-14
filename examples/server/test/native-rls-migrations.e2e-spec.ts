import { access } from 'node:fs/promises';

import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import {
  ApiKey,
  entities as authEntities,
  SystemAccount,
  User,
  Workspace,
  workspaceEntities,
  WorkspaceInvitation,
  WorkspaceMember,
} from '@nest-boot/auth';
import { getDatabaseConfig } from '@nest-boot/database';
import { entities as queueEntities } from '@nest-boot/queue-api';

import { Migration00000000000000_Initial } from '../src/database/migrations/Migration00000000000000_Initial.js';
import { Migration20261114140546_AuthSchema } from '../src/database/migrations/Migration20261114140546_AuthSchema.js';

describe('example native RLS migrations with PGlite', () => {
  let orm: MikroORM;

  const readPolicies = (instance: MikroORM) =>
    [
      instance.getMetadata(User),
      instance.getMetadata(ApiKey),
      instance.getMetadata(SystemAccount),
      instance.getMetadata(Workspace),
      instance.getMetadata(WorkspaceMember),
      instance.getMetadata(WorkspaceInvitation),
    ].map((metadata) => metadata.policies);

  let originalPolicies: ReturnType<typeof readPolicies>;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'memory://');
    const { metadataCache } = await getDatabaseConfig();
    const initialize = () =>
      MikroORM.init({
        dbName: 'memory://',
        driverOptions: { extensions: { pgcrypto, uuid_ossp } },
        metadataProvider: TsMorphMetadataProvider,
        metadataCache,
        entities: [...authEntities, ...workspaceEntities, ...queueEntities],
        extensions: [Migrator],
        migrations: {
          migrationsList: [
            Migration00000000000000_Initial,
            Migration20261114140546_AuthSchema,
          ],
          path: './src/database/migrations',
          pathTs: './src/database/migrations',
          snapshotName: '.snapshot-postgres',
          snapshot: true,
          snapshotOnMigrate: false,
        },
      });
    const cold = await initialize();
    try {
      originalPolicies = readPolicies(cold);
    } finally {
      await cold.close();
    }
    orm = await initialize();
    await orm.migrator.up();
  }, 30000);

  afterAll(async () => {
    try {
      await orm?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('preserves policy callbacks across repeated discovery without metadata caching', () => {
    expect(orm.config.get('metadataCache').enabled).toBe(false);
    expect(readPolicies(orm)).toEqual(originalPolicies);
  });

  it('creates request roles with NOLOGIN and NOINHERIT', async () => {
    expect(
      await orm.em.execute(
        "select rolname, rolcanlogin, rolinherit from pg_roles where rolname in ('anonymous', 'authenticated') order by rolname",
      ),
    ).toEqual([
      { rolname: 'anonymous', rolcanlogin: false, rolinherit: false },
      { rolname: 'authenticated', rolcanlogin: false, rolinherit: false },
    ]);
  });

  it('installs extensions in their namespace and permits request-role calls', async () => {
    expect(
      await orm.em.execute(
        "select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname in ('uuid-ossp', 'pgcrypto') order by e.extname",
      ),
    ).toEqual([
      { extname: 'pgcrypto', nspname: 'extensions' },
      { extname: 'uuid-ossp', nspname: 'extensions' },
    ]);
    for (const role of ['anonymous', 'authenticated']) {
      const em = orm.em.fork({ session: { role } });
      expect(
        await em.execute(
          "select extensions.uuid_generate_v4() is not null as uuid, encode(extensions.digest('test', 'sha256'), 'hex') as hash",
        ),
      ).toEqual([
        {
          uuid: true,
          hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        },
      ]);
    }
  });

  it('automatically grants future tables, functions and sequences without another grants migration', async () => {
    const em = orm.em.fork();
    try {
      await em.execute(
        'create function default_privilege_probe_value() returns integer language sql as $$ select 42 $$',
      );
      // Remove PostgreSQL's PUBLIC default to verify each role's explicit grant.
      await em.execute(
        'revoke execute on function default_privilege_probe_value() from public',
      );
      await em.execute(
        'create table default_privilege_probe (id bigserial primary key)',
      );
      await em.execute(
        'alter table default_privilege_probe enable row level security',
      );
      const authenticated = orm.em.fork({ session: { role: 'authenticated' } });
      expect(
        await authenticated.execute('select * from default_privilege_probe'),
      ).toEqual([]);
      await expect(
        authenticated.execute(
          'insert into default_privilege_probe default values',
        ),
      ).rejects.toThrow(/row.level security/i);
      await em.execute(
        'create policy probe_access on default_privilege_probe to authenticated using (true) with check (true)',
      );
      expect(
        await authenticated.execute(
          'insert into default_privilege_probe default values returning id',
        ),
      ).toHaveLength(1);
      expect(
        await orm.em
          .fork({ session: { role: 'anonymous' } })
          .execute('select * from default_privilege_probe'),
      ).toEqual([]);
      for (const role of ['anonymous', 'authenticated']) {
        expect(
          await orm.em
            .fork({ session: { role } })
            .execute('select default_privilege_probe_value() as value'),
        ).toEqual([{ value: 42 }]);
        for (const privilege of ['usage', 'select', 'update']) {
          expect(
            await em.execute(
              "select has_sequence_privilege(?, 'default_privilege_probe_id_seq', ?) as allowed",
              [role, privilege],
            ),
          ).toEqual([{ allowed: true }]);
        }
        for (const privilege of [
          'select',
          'insert',
          'update',
          'delete',
          'truncate',
          'references',
          'trigger',
        ]) {
          expect(
            await em.execute(
              "select has_table_privilege(?, 'default_privilege_probe', ?) as allowed",
              [role, privilege],
            ),
          ).toEqual([{ allowed: true }]);
        }
      }
      const anonymous = orm.em.fork({ session: { role: 'anonymous' } });
      await expect(
        anonymous.execute(
          'insert into default_privilege_probe (id) values (-1)',
        ),
      ).rejects.toThrow(/row.level security/i);
      // ALL includes TRUNCATE, which is not restricted by row policies.
      // Exercise it only on this disposable probe, never application tables.
      await anonymous.execute('truncate default_privilege_probe');
      expect(await em.execute('select * from default_privilege_probe')).toEqual(
        [],
      );
    } finally {
      await em.execute('drop table if exists default_privilege_probe');
      await em.execute(
        'drop function if exists default_privilege_probe_value()',
      );
    }
  });

  it('creates the complete baseline through the official Migrator', async () => {
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.migrator.getExecuted()).toHaveLength(2);
    const policies = await orm.em.execute<
      {
        policyname: string;
        qual: string;
        with_check: string;
      }[]
    >(
      "select policyname, qual, with_check from pg_policies where qual like '%app.auth.workspace.id%'",
    );
    expect(policies.map(({ policyname }) => policyname).sort()).toEqual([
      'api_key_all_policy',
      'workspace_delete_policy',
      'workspace_invitation_all_policy',
      'workspace_member_all_policy',
      'workspace_update_policy',
    ]);
    for (const policy of policies) {
      expect(policy.qual).toContain('app.auth.workspace.id');
      expect(policy.qual).not.toContain('app.workspace_id');
      if (policy.with_check) {
        expect(policy.with_check).toContain('app.auth.workspace.id');
      }
    }
  });

  it('matches current entity metadata immediately after migration without schema synchronization', async () => {
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });

  it('matches the committed snapshot without generating another migration', async () => {
    await access('./src/database/migrations/.snapshot-postgres.json');
    expect(await orm.migrator.checkSchema()).toBe(false);
  });

  it('enforces the example policy and grants with an anonymous workspace session', async () => {
    const admin = orm.em.fork();
    await admin.insert(Workspace, { name: 'Example' });
    const em = orm.em.fork({
      session: {
        role: 'anonymous',
        variables: { 'app.auth.workspace.id': '1' },
      },
    });
    expect(
      (await em.find(Workspace, {})).map((workspace) => workspace.id),
    ).toEqual(['1']);
    expect(
      await em.nativeUpdate(Workspace, { id: '1' }, { name: 'Denied' }),
    ).toBe(0);
    em.setSessionContext({ role: 'authenticated' });
    expect(
      await em.nativeUpdate(Workspace, { id: '1' }, { name: 'Allowed' }),
    ).toBe(1);
    em.setSessionContext({ variables: { 'app.auth.workspace.id': '2' } });
    expect(
      await em.nativeUpdate(Workspace, { id: '1' }, { name: 'Denied' }),
    ).toBe(0);
  });

  it('rolls back generated tables while preserving initialization and can rebuild the baseline', async () => {
    const readDefaultPrivileges = () =>
      orm.em.execute(
        "select d.defaclobjtype, r.rolname, a.privilege_type, a.is_grantable from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a join pg_roles r on r.oid = a.grantee where n.nspname = 'public' and r.rolname in ('anonymous', 'authenticated') order by 1, 2, 3",
      );
    const defaults = await readDefaultPrivileges();
    expect(defaults.length).toBeGreaterThan(0);
    await orm.migrator.down({ to: 0 });
    expect(await orm.migrator.getExecuted()).toEqual([]);
    expect(
      await orm.em.execute(
        "select to_regclass('public.api_key') as api_key, to_regclass('public.system_account') as system_account",
      ),
    ).toEqual([{ api_key: null, system_account: null }]);
    expect(await readDefaultPrivileges()).toEqual(defaults);
    expect(
      await orm.em.execute(
        "select rolname from pg_roles where rolname in ('anonymous', 'authenticated')",
      ),
    ).toHaveLength(2);
    await orm.migrator.up();
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await readDefaultPrivileges()).toEqual(defaults);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });
});
