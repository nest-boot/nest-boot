import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { ApiKey } from '../src/app/api-key/api-key.entity.js';
import { Account } from '../src/app/auth/entities/account.entity.js';
import { Session } from '../src/app/auth/entities/session.entity.js';
import { Verification } from '../src/app/auth/entities/verification.entity.js';
import { User } from '../src/app/user/user.entity.js';
import { Workspace } from '../src/app/workspace/workspace.entity.js';
import { WorkspaceInvitation } from '../src/app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../src/app/workspace-member/workspace-member.entity.js';
import { Migration20260902080630_Baseline } from '../src/database/migrations/Migration20260902080630_Baseline.js';
import { Migration20260909000000_NativeRls } from '../src/database/migrations/Migration20260909000000_NativeRls.js';

describe('example native RLS migrations with PGlite', () => {
  let orm: MikroORM;
  let cacheDir: string;
  const readPolicies = (instance: MikroORM) =>
    [
      instance.getMetadata(User),
      instance.getMetadata(Workspace),
      instance.getMetadata(WorkspaceMember),
    ].map((metadata) => metadata.policies);
  let originalPolicies: ReturnType<typeof readPolicies>;

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'nest-boot-native-rls-metadata-'));
    const initialize = () =>
      MikroORM.init({
        dbName: 'memory://',
        metadataProvider: TsMorphMetadataProvider,
        metadataCache: { enabled: true, options: { cacheDir } },
        entities: [
          User,
          Account,
          Session,
          Verification,
          Workspace,
          WorkspaceMember,
          WorkspaceInvitation,
          ApiKey,
        ],
        extensions: [Migrator],
        migrations: {
          migrationsList: [
            Migration20260902080630_Baseline,
            Migration20260909000000_NativeRls,
          ],
          snapshot: false,
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
  }, 30_000);

  afterAll(async () => {
    await orm?.close();
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  });

  it('preserves all policy expressions when reloading the metadata cache', () => {
    expect(readPolicies(orm)).toEqual(originalPolicies);
  });

  it('runs both migrations through the official Migrator', async () => {
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.migrator.getExecuted()).toHaveLength(2);
    const policies = await orm.em.execute<
      { policyname: string; qual: string; with_check: string }[]
    >(
      "select policyname, qual, with_check from pg_policies where policyname in ('workspace_update_policy', 'workspace_member_workspace_all_authenticated_policy')",
    );
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy.qual).toContain('app.workspace');
      expect(policy.qual).not.toContain('app.workspace_id');
      expect(policy.with_check).toContain('app.workspace');
    }
  });

  it('preserves all existing policies in native metadata without policy drift', async () => {
    const diff = await orm.schema.getUpdateSchemaSQL({ wrap: false });
    expect(diff).not.toContain('disable row level security');
    // The baseline has pre-existing column/default differences. Synchronize
    // this disposable database, then require stable native policy round-trips.
    const before = await orm.em.execute(
      'select tablename, policyname from pg_policies order by tablename, policyname',
    );
    await orm.schema.update();
    expect(
      await orm.em.execute(
        'select tablename, policyname from pg_policies order by tablename, policyname',
      ),
    ).toEqual(before);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });

  it('enforces the example policy and grants with an anonymous workspace session', async () => {
    const admin = orm.em.fork();
    await admin.insert(Workspace, { id: '1', name: 'Example' });
    const em = orm.em.fork({
      session: { role: 'anonymous', variables: { 'app.workspace': '1' } },
    });
    expect(
      (await em.find(Workspace, {})).map((workspace) => workspace.id),
    ).toEqual(['1']);
    await expect(
      em.nativeUpdate(Workspace, { id: '1' }, { name: 'Denied' }),
    ).rejects.toThrow();
    em.setSessionContext({ role: 'authenticated' });
    expect(
      await em.nativeUpdate(Workspace, { id: '1' }, { name: 'Allowed' }),
    ).toBe(1);
    em.setSessionContext({ variables: { 'app.workspace': '2' } });
    expect(
      await em.nativeUpdate(Workspace, { id: '1' }, { name: 'Denied' }),
    ).toBe(0);
  });

  it('reverts and reapplies the variable migration', async () => {
    await orm.migrator.down();
    const [policy] = await orm.em.execute<{ qual: string }[]>(
      "select qual from pg_policies where policyname = 'workspace_update_policy'",
    );
    expect(policy.qual).toContain('app.workspace_id');
    await orm.migrator.up();
    expect(await orm.migrator.getPending()).toEqual([]);
  });
});
