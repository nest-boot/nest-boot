import { EntityManager } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import {
  type AccessControlService,
  ApiKeyService,
  AuthMiddleware,
  type AuthModuleOptions,
  SessionService,
  WorkspaceService,
} from '@nest-boot/auth';
import { loadConfigFromEnv } from '@nest-boot/mikro-orm';
import { REQUEST, RequestContext } from '@nest-boot/request-context';
import type { Request } from 'express';

import { ApiKey } from '../src/app/api-key/api-key.entity.js';
import { Account } from '../src/app/auth/entities/account.entity.js';
import { Session } from '../src/app/auth/entities/session.entity.js';
import { Verification } from '../src/app/auth/entities/verification.entity.js';
import { User } from '../src/app/user/user.entity.js';
import { Workspace } from '../src/app/workspace/workspace.entity.js';
import { WorkspaceInvitation } from '../src/app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../src/app/workspace-member/workspace-member.entity.js';
import { Migration20260910000000_Baseline } from '../src/database/migrations/Migration20260910000000_Baseline.js';

describe('example native RLS migrations with PGlite', () => {
  let orm: MikroORM;
  const readPolicies = (instance: MikroORM) =>
    [
      instance.getMetadata(User),
      instance.getMetadata(Workspace),
      instance.getMetadata(WorkspaceMember),
    ].map((metadata) => metadata.policies);
  let originalPolicies: ReturnType<typeof readPolicies>;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'memory://');
    const { metadataCache } = await loadConfigFromEnv();
    const initialize = () =>
      MikroORM.init({
        dbName: 'memory://',
        metadataProvider: TsMorphMetadataProvider,
        metadataCache,
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
          migrationsList: [Migration20260910000000_Baseline],
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

  it('creates the complete baseline through the official Migrator', async () => {
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.migrator.getExecuted()).toHaveLength(1);
    const policies = await orm.em.execute<
      { policyname: string; qual: string; with_check: string }[]
    >(
      "select policyname, qual, with_check from pg_policies where qual like '%app.workspace%'",
    );
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      expect(policy.qual).toContain('app.workspace');
      expect(policy.qual).not.toContain('app.workspace_id');
      expect(policy.with_check).toContain('app.workspace');
    }
  });

  it('matches current entity metadata immediately after migration without schema synchronization', async () => {
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });

  it('generates distinct policy names for repeated commands', async () => {
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace' order by policyname",
      ),
    ).toEqual([
      { policyname: 'workspace_delete_policy' },
      { policyname: 'workspace_insert_policy' },
      { policyname: 'workspace_select_policy' },
      { policyname: 'workspace_select_policy_2' },
      { policyname: 'workspace_update_policy' },
      { policyname: 'workspace_update_policy_2' },
    ]);
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

  it.each([
    'anonymous',
    'session',
    'user-key',
    'workspace-key',
    'non-member',
    'unconfigured-session',
  ] as const)(
    'applies native database identity directly from AuthMiddleware for %s',
    async (kind) => {
      const admin = orm.em.fork();
      const workspace = await admin.findOneOrFail(Workspace, '1');
      const user = admin.create(User, {
        name: kind,
        email: `${kind}@example.test`,
        emailVerified: true,
        permissions: [],
        roles: ['user'],
      });
      await admin.persist(user).flush();
      const isMember =
        kind === 'session' ||
        kind === 'user-key' ||
        kind === 'unconfigured-session';
      if (isMember) {
        await admin.insert(WorkspaceMember, { user, workspace, name: kind });
      }
      const hasUser = isMember || kind === 'non-member';
      const em = orm.em.fork(
        kind === 'unconfigured-session'
          ? {}
          : {
              session: {
                role: 'anonymous',
                variables: { 'app.workspace': '1' },
              },
            },
      );
      const options = {
        entities: {
          user: User,
          account: Account,
          session: Session,
          verification: Verification,
          workspace: Workspace,
          workspaceMember: WorkspaceMember,
          workspaceInvitation: WorkspaceInvitation,
          apiKey: ApiKey,
        },
      } satisfies AuthModuleOptions;
      const middleware = new AuthMiddleware(
        options,
        {
          getSession: vi
            .fn()
            .mockResolvedValue(
              hasUser && kind !== 'user-key'
                ? { user, session: new Session() }
                : null,
            ),
        } as unknown as SessionService,
        {
          validate: vi.fn().mockResolvedValue({
            apiKey: new ApiKey(),
            ownerType: kind === 'user-key' ? 'user' : 'workspace',
            user,
            workspace,
          }),
        } as unknown as ApiKeyService,
        em,
      );
      const request = {
        headers: {
          ...(kind === 'workspace-key' ? {} : { 'x-workspace-id': '1' }),
          ...(kind.endsWith('key') ? { authorization: 'Bearer sk-key' } : {}),
        },
      } as Request;
      const context = new RequestContext({ type: 'http' });
      context.set(REQUEST, request);
      await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(
          await em.execute(
            "select current_user as role, current_setting('app.user', true) as app_user, current_setting('app.workspace', true) as app_workspace",
          ),
        ).toEqual([
          {
            role: kind === 'anonymous' ? 'anonymous' : 'authenticated',
            app_user: hasUser ? user.id : '',
            app_workspace: kind === 'non-member' ? '' : '1',
          },
        ]);
        if (kind === 'anonymous') {
          await expect(
            em.nativeUpdate(Workspace, '1', { name: 'Denied' }),
          ).rejects.toThrow();
        } else {
          expect(await em.nativeUpdate(Workspace, '1', { name: kind })).toBe(
            kind === 'non-member' ? 0 : 1,
          );
          if (hasUser) {
            expect(
              await em.nativeUpdate(User, user.id, { name: `${kind}-updated` }),
            ).toBe(1);
          }
        }
      });
    },
  );

  it('persists member permissions across isolated auth forks without flushing unrelated changes', async () => {
    const admin = orm.em.fork();
    const workspace = await admin.findOneOrFail(Workspace, '1');
    const originalName = workspace.name;
    const member = admin.create(WorkspaceMember, {
      workspace,
      name: 'Permission target',
    });
    await admin.persist(member).flush();
    const session = {
      role: 'authenticated',
      variables: { 'app.workspace': workspace.id, 'app.user': '' },
    };
    const scoped = orm.em.fork({ session });
    const service = new WorkspaceService(
      scoped,
      {
        entities: {
          user: User,
          account: Account,
          session: Session,
          verification: Verification,
          workspace: Workspace,
          workspaceMember: WorkspaceMember,
          workspaceInvitation: WorkspaceInvitation,
          apiKey: ApiKey,
        },
      },
      {
        assertCurrentWorkspace: vi.fn(),
        assertWorkspaceCan: vi.fn(),
        assertCanGrantWorkspacePermissions: vi.fn(),
      } as unknown as AccessControlService,
    );
    const context = new RequestContext({ type: 'test' });
    context.set(EntityManager, scoped);

    await RequestContext.run(context, async () => {
      const pendingWorkspace = await scoped.findOneOrFail(
        Workspace,
        workspace.id,
      );
      pendingWorkspace.name = 'Unrelated pending change';
      for (const permissions of [
        ['Workspace:update'],
        ['WorkspaceMember:update'],
        [],
      ]) {
        const detached = await service.getMemberById(workspace, member.id);
        expect(detached).not.toBeNull();
        const updated = await service.setMemberPermissions(
          detached,
          permissions,
        );
        expect(updated.permissions).toEqual(permissions);
        const persisted = await orm.em
          .fork()
          .findOneOrFail(WorkspaceMember, member.id);
        expect(persisted.permissions).toEqual(permissions);
      }
      expect(RequestContext.get(EntityManager)).toBe(scoped);
      expect(scoped.getSessionContext()).toEqual(session);
    });
    expect(
      (await orm.em.fork().findOneOrFail(Workspace, workspace.id)).name,
    ).toBe(originalName);
  });

  it('reverts and reapplies the complete baseline while preserving shared roles', async () => {
    await orm.migrator.down();
    expect(await orm.migrator.getExecuted()).toEqual([]);
    expect(
      await orm.em.execute(
        "select tablename from pg_tables where schemaname = 'public' and tablename <> 'mikro_orm_migrations'",
      ),
    ).toEqual([]);
    expect(
      await orm.em.execute(
        "select rolname from pg_roles where rolname in ('anonymous', 'authenticated')",
      ),
    ).toHaveLength(2);
    await orm.migrator.up();
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });
});
