import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';

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
import { WorkspaceMemberStatus } from '../src/app/workspace-member/enums/workspace-member-status.enum.js';
import { WorkspaceInvitation } from '../src/app/workspace-member/workspace-invitation.entity.js';
import { WorkspaceMember } from '../src/app/workspace-member/workspace-member.entity.js';
import { Migration20260910000000_Baseline } from '../src/database/migrations/Migration20260910000000_Baseline.js';

describe('example native RLS migrations with PGlite', () => {
  let orm: MikroORM;
  const readPolicies = (instance: MikroORM) =>
    [
      instance.getMetadata(User),
      instance.getMetadata(ApiKey),
      instance.getMetadata(Workspace),
      instance.getMetadata(WorkspaceMember),
      instance.getMetadata(WorkspaceInvitation),
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
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.qual).toContain('app.workspace');
      expect(policy.qual).not.toContain('app.workspace_id');
      expect(policy.with_check).toContain('app.workspace');
    }
  });

  it('matches current entity metadata immediately after migration without schema synchronization', async () => {
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });

  it('matches the committed snapshot without generating another migration', async () => {
    await access('./src/database/migrations/.snapshot-postgres.json');
    expect(await orm.migrator.checkSchema()).toBe(false);
  });

  it('generates distinct policy names for composed policies', async () => {
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace' order by policyname",
      ),
    ).toEqual([
      { policyname: 'workspace_all_policy' },
      { policyname: 'workspace_delete_policy' },
      { policyname: 'workspace_select_policy' },
      { policyname: 'workspace_update_policy' },
    ]);
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace_invitation' order by policyname",
      ),
    ).toEqual([{ policyname: 'workspace_invitation_all_policy' }]);
  });

  it('keeps child policies free of parent-workspace subqueries', async () => {
    const policies = await orm.em.execute<
      { qual: string; with_check: string | null }[]
    >(
      "select qual, with_check from pg_policies where tablename in ('workspace_member', 'workspace_invitation')",
    );
    expect(policies).toHaveLength(3);
    for (const policy of policies) {
      expect(policy.qual).toContain('current_setting');
      expect(policy.qual).not.toMatch(/exists|deleted_at/i);
      if (policy.with_check) {
        expect(policy.with_check).toContain('app.workspace');
        expect(policy.with_check).not.toMatch(/exists|deleted_at/i);
      }
    }
  });

  it('enforces the example policy and grants with an anonymous workspace session', async () => {
    const admin = orm.em.fork();
    await admin.insert(Workspace, { name: 'Example' });
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

  describe('API-key owner policy boundaries', () => {
    const userId = '900001';
    const foreignId = '900002';
    const probeRole = 'api_key_rls_probe';
    const anonymousProbeRole = 'api_key_anonymous_rls_probe';
    let keys: ApiKey[];

    const scoped = (variables?: Record<string, string>, role = probeRole) =>
      orm.em.fork({ session: { role, variables } });

    const insertKey = (
      em: ReturnType<typeof scoped>,
      id: string,
      ownerType: string,
      ownerId: string,
    ) =>
      em.execute(
        'insert into api_key (id, owner_type, owner_id, name, key) values (?, ?, ?, ?, ?)',
        [id, ownerType, ownerId, 'Policy probe', randomUUID()],
      );

    beforeAll(async () => {
      const admin = orm.em.fork();
      const user = admin.create(User, {
        id: userId,
        name: 'API-key owner',
        email: 'api-key-owner@example.test',
        emailVerified: true,
        permissions: [],
        roles: ['user'],
      });
      const foreignUser = admin.create(User, {
        id: foreignId,
        name: 'Other API-key owner',
        email: 'other-api-key-owner@example.test',
        emailVerified: true,
        permissions: [],
        roles: ['user'],
      });
      // The IDs intentionally collide across the two owner types.
      const workspace = admin.create(Workspace, {
        id: userId,
        name: 'Key owner',
      });
      const foreignWorkspace = admin.create(Workspace, {
        id: foreignId,
        name: 'Other key owner',
      });
      keys = [user, workspace, foreignUser, foreignWorkspace].map((owner) =>
        admin.create(ApiKey, {
          owner,
          name: 'Owner boundary fixture',
          key: randomUUID(),
        }),
      );
      await admin.persist(keys).flush();

      // Grant only dedicated test roles table access to exercise RLS itself.
      // Production authenticated/anonymous table privileges stay unchanged.
      await admin.execute(`create role ${probeRole} nologin inherit`);
      await admin.execute(`create role ${anonymousProbeRole} nologin inherit`);
      await admin.execute(`grant authenticated to ${probeRole}`);
      await admin.execute(`grant anonymous to ${anonymousProbeRole}`);
      await admin.execute(
        `grant ${probeRole}, ${anonymousProbeRole} to current_user`,
      );
      await admin.execute(
        `grant select, insert, update, delete on api_key to ${probeRole}, ${anonymousProbeRole}`,
      );
    });

    afterAll(async () => {
      const admin = orm.em.fork();
      await admin.execute(
        `revoke all on api_key from ${probeRole}, ${anonymousProbeRole}`,
      );
      await admin.execute(`drop role ${probeRole}, ${anonymousProbeRole}`);
      await admin.nativeDelete(ApiKey, { id: keys.map((key) => key.id) });
      await admin.nativeDelete(User, { id: [userId, foreignId] });
      await admin.nativeDelete(Workspace, { id: [userId, foreignId] });
    });

    it('enables RLS without granting request roles direct access to secrets', async () => {
      expect(
        await orm.em.execute(
          "select relrowsecurity from pg_class where oid = 'api_key'::regclass",
        ),
      ).toEqual([{ relrowsecurity: true }]);
      for (const role of ['anonymous', 'authenticated']) {
        for (const privilege of ['select', 'insert', 'update', 'delete']) {
          expect(
            await orm.em.execute(
              "select has_table_privilege(?, 'api_key', ?) as allowed",
              [role, privilege],
            ),
          ).toEqual([{ allowed: false }]);
        }
      }
      expect(
        await orm.em.execute(
          'select owner_type, owner_id::text from api_key where id in (?, ?) order by owner_type',
          [keys[0].id, keys[1].id],
        ),
      ).toEqual([
        { owner_type: 'user', owner_id: userId },
        { owner_type: 'workspace', owner_id: userId },
      ]);
    });

    it.each([
      { name: 'user only', user: userId, workspace: '', visible: [0] },
      { name: 'workspace only', user: '', workspace: userId, visible: [1] },
      {
        name: 'distinct user and workspace',
        user: foreignId,
        workspace: userId,
        visible: [1, 2],
      },
      { name: 'empty identity', user: '', workspace: '', visible: [] },
    ])(
      'restricts all operations by owner type and ID: $name',
      async (identity) => {
        const em = scoped({
          'app.user': identity.user,
          'app.workspace': identity.workspace,
        });
        const visibleIds = identity.visible
          .map((index) => keys[index].id)
          .sort();
        expect((await em.find(ApiKey, {})).map((key) => key.id).sort()).toEqual(
          visibleIds,
        );
        for (const key of keys) {
          expect(
            await em.nativeUpdate(ApiKey, key.id, { name: identity.name }),
          ).toBe(visibleIds.includes(key.id) ? 1 : 0);
          if (!visibleIds.includes(key.id)) {
            expect(await em.nativeDelete(ApiKey, key.id)).toBe(0);
          }
        }
      },
    );

    it('denies missing identity and anonymous access even with table privileges', async () => {
      expect(await scoped().find(ApiKey, {})).toEqual([]);
      const anonymous = scoped(
        { 'app.user': userId, 'app.workspace': userId },
        anonymousProbeRole,
      );
      expect(await anonymous.find(ApiKey, {})).toEqual([]);
      expect(
        await anonymous.nativeUpdate(ApiKey, keys[0].id, { name: 'Denied' }),
      ).toBe(0);
      expect(await anonymous.nativeDelete(ApiKey, keys[0].id)).toBe(0);
      await expect(
        insertKey(anonymous, '900100', 'user', userId),
      ).rejects.toThrow(/row.level security/i);
    });

    it.each(['user', 'workspace'] as const)(
      'checks both owner columns on insert and update for %s keys',
      async (ownerType) => {
        const em = scoped({
          'app.user': ownerType === 'user' ? userId : '',
          'app.workspace': ownerType === 'workspace' ? userId : '',
        });
        const otherType = ownerType === 'user' ? 'workspace' : 'user';
        const id = ownerType === 'user' ? '900101' : '900102';
        try {
          await expect(insertKey(em, id, otherType, userId)).rejects.toThrow(
            /row.level security/i,
          );
          await expect(insertKey(em, id, ownerType, foreignId)).rejects.toThrow(
            /row.level security/i,
          );
          await insertKey(em, id, ownerType, userId);
          await expect(
            em.execute('update api_key set owner_type = ? where id = ?', [
              otherType,
              id,
            ]),
          ).rejects.toThrow(/row.level security/i);
          await expect(
            em.execute('update api_key set owner_id = ? where id = ?', [
              foreignId,
              id,
            ]),
          ).rejects.toThrow(/row.level security/i);
          const stored = await em.findOneOrFail(ApiKey, id);
          expect(stored.owner.id).toBe(userId);
          expect(stored.owner.unwrap()).toBeInstanceOf(
            ownerType === 'user' ? User : Workspace,
          );
          expect(await em.nativeDelete(ApiKey, id)).toBe(1);
        } finally {
          await orm.em.fork().nativeDelete(ApiKey, id);
        }
      },
    );
  });

  describe('workspace policy boundaries', () => {
    let user: User;
    let current: Workspace;
    let foreign: Workspace;
    let unrelated: Workspace;
    let ownMember: WorkspaceMember;
    let foreignMember: WorkspaceMember;
    let foreignInvitation: WorkspaceInvitation;

    const scoped = (workspaceId: string, userId = user.id) =>
      orm.em.fork({
        session: {
          role: 'authenticated',
          variables: { 'app.user': userId, 'app.workspace': workspaceId },
        },
      });
    const serviceFor = (em: EntityManager) =>
      new WorkspaceService<
        Workspace,
        WorkspaceMember,
        WorkspaceInvitation,
        User
      >(
        em,
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
          assertCurrentUser: vi.fn(),
          assertUserCan: vi.fn(),
          assertCurrentWorkspace: vi.fn(),
          assertCurrentWorkspaceMember: vi.fn(),
          assertWorkspaceCan: vi.fn(),
        } as unknown as AccessControlService,
      );

    beforeAll(async () => {
      const admin = orm.em.fork();
      user = admin.create(User, {
        name: 'Policy user',
        email: 'policy-user@example.test',
        emailVerified: true,
        permissions: [],
        roles: ['user'],
      });
      current = admin.create(Workspace, { name: 'Current' });
      foreign = admin.create(Workspace, { name: 'Foreign' });
      unrelated = admin.create(Workspace, { name: 'Unrelated' });
      ownMember = admin.create(WorkspaceMember, {
        user,
        workspace: current,
        name: user.name,
      });
      foreignMember = admin.create(WorkspaceMember, {
        user,
        workspace: foreign,
        name: user.name,
        status: WorkspaceMemberStatus.DISABLED,
      });
      foreignInvitation = admin.create(WorkspaceInvitation, {
        email: user.email,
        inviter: user,
        workspace: foreign,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await admin
        .persist([
          user,
          current,
          foreign,
          unrelated,
          ownMember,
          foreignMember,
          foreignInvitation,
        ])
        .flush();
    });

    it.each(['selected', 'unselected'] as const)(
      'allows reading but not changing own foreign memberships with a %s workspace',
      async (selection) => {
        const em = scoped(selection === 'selected' ? current.id : '');
        expect(
          await em.findOne(WorkspaceMember, foreignMember.id),
        ).not.toBeNull();
        expect(
          await em.nativeUpdate(WorkspaceMember, foreignMember.id, {
            name: 'Must not change',
          }),
        ).toBe(0);
        expect(await em.nativeDelete(WorkspaceMember, foreignMember.id)).toBe(
          0,
        );
      },
    );

    it.each(['user', 'workspace-key'] as const)(
      'rejects cross-workspace member inserts and moves for a %s identity',
      async (identity) => {
        const em = scoped(current.id, identity === 'user' ? user.id : '');
        await expect(
          em.insert(WorkspaceMember, {
            user: user.id,
            workspace: unrelated.id,
            name: 'Must not join',
          }),
        ).rejects.toThrow(/row.level security/i);
        await expect(
          em.nativeUpdate(WorkspaceMember, ownMember.id, {
            workspace: unrelated.id,
          }),
        ).rejects.toThrow(/row.level security/i);
        expect(
          await em.nativeUpdate(WorkspaceMember, ownMember.id, {
            name: 'Allowed in current workspace',
          }),
        ).toBe(1);
      },
    );

    it.each(['user', 'workspace-key'] as const)(
      'isolates invitation reads and writes for a %s identity',
      async (identity) => {
        const em = scoped(current.id, identity === 'user' ? user.id : '');
        expect(await em.find(WorkspaceInvitation, {})).toEqual([]);
        expect(
          await em.nativeUpdate(WorkspaceInvitation, foreignInvitation.id, {
            email: 'must-not-change@example.test',
          }),
        ).toBe(0);
        expect(
          await em.nativeDelete(WorkspaceInvitation, foreignInvitation.id),
        ).toBe(0);
        await expect(
          em.insert(WorkspaceInvitation, {
            id: randomUUID(),
            workspace: foreign.id,
            inviter: user.id,
            email: `${identity}@example.test`,
            expiresAt: new Date(),
          }),
        ).rejects.toThrow(/row.level security/i);

        const id = await em.insert(WorkspaceInvitation, {
          id: randomUUID(),
          workspace: current.id,
          inviter: user.id,
          email: `${identity}@example.test`,
          expiresAt: new Date(),
        });
        expect(await em.findOne(WorkspaceInvitation, id)).not.toBeNull();
        await expect(
          em.nativeUpdate(WorkspaceInvitation, id, {
            workspace: foreign.id,
          }),
        ).rejects.toThrow(/row.level security/i);
        expect(
          await em.nativeUpdate(WorkspaceInvitation, id, {
            email: `updated-${identity}@example.test`,
          }),
        ).toBe(1);
        expect(await em.nativeDelete(WorkspaceInvitation, id)).toBe(1);
      },
    );

    it('denies direct invitation access without a workspace but permits the authorized recipient service', async () => {
      const em = scoped('');
      expect(await em.find(WorkspaceInvitation, {})).toEqual([]);
      expect(
        await em.nativeDelete(WorkspaceInvitation, foreignInvitation.id),
      ).toBe(0);
      const service = serviceFor(em);
      expect(
        (await service.getUserInvitation(foreignInvitation.id, user))?.id,
      ).toBe(foreignInvitation.id);
      expect(
        (await service.listUserInvitations(user)).map(
          (invitation) => invitation.id,
        ),
      ).toContain(foreignInvitation.id);
      expect(em.getSessionContext()?.variables?.['app.workspace']).toBe('');
    });

    it('creates a workspace and owner in an isolated transaction before selecting a workspace', async () => {
      const em = scoped('');
      const pendingUser = await em.findOneOrFail(User, user.id);
      pendingUser.name = 'Unrelated pending change';
      const context = new RequestContext({ type: 'test' });
      context.set(EntityManager, em);
      const workspace = await RequestContext.run(context, async () => {
        const result = await serviceFor(em).createWorkspace(pendingUser, {
          name: 'Created via service',
        });
        expect(RequestContext.get(EntityManager)).toBe(em);
        return result;
      });
      const admin = orm.em.fork();
      const owner = await admin.findOneOrFail(WorkspaceMember, {
        user: user.id,
        workspace: workspace.id,
      });
      expect(owner.roles).toEqual(['owner']);
      expect(owner.status).toBe(WorkspaceMemberStatus.ACTIVE);
      expect((await admin.findOneOrFail(User, user.id)).name).toBe(
        'Policy user',
      );
      expect(em.getSessionContext()?.variables?.['app.workspace']).toBe('');
    });

    it('rolls back workspace creation when owner membership persistence fails', async () => {
      const em = scoped('');
      const name = 'Must roll back';
      await expect(
        serviceFor(em).createWorkspace(
          Object.assign(new User(), {
            id: '9223372036854775807',
            name: 'Missing',
            email: 'missing@example.test',
          }),
          { name },
        ),
      ).rejects.toThrow();
      expect(await orm.em.fork().count(Workspace, { name })).toBe(0);
    });

    it('requires the authorized service to create workspaces', async () => {
      const em = scoped('');
      await expect(
        em.insert(Workspace, { name: 'Direct insert is denied' }),
      ).rejects.toThrow(/permission denied/i);
      // Check the SQL path without RETURNING too: SELECT policies do not
      // necessarily apply to INSERT, so table grants must enforce this boundary.
      await expect(
        em.execute(
          'insert into workspace (name, deleted_at) values (?, now())',
          ['Direct deleted insert is denied'],
        ),
      ).rejects.toThrow(/permission denied/i);
    });

    const accessMatrix = (
      ['anonymous', 'self', 'other-member', 'workspace-key'] as const
    ).flatMap((identity) =>
      (['current', 'foreign', 'deleted'] as const).flatMap((scope) =>
        (['workspace_member', 'workspace_invitation'] as const).map(
          (table) => ({
            identity,
            scope,
            table,
          }),
        ),
      ),
    );

    it.each(accessMatrix)(
      '$identity accessing $table in a $scope workspace respects read/write boundaries',
      async ({ identity, scope, table }) => {
        const admin = orm.em.fork();
        const targetWorkspace = admin.create(Workspace, {
          name: 'Matrix target',
        });
        const otherUser = admin.create(User, {
          name: 'Other member',
          email: `${randomUUID()}@example.test`,
          emailVerified: true,
          permissions: [],
          roles: ['user'],
        });
        const targetMember = admin.create(WorkspaceMember, {
          workspace: targetWorkspace,
          name: 'Matrix member',
          user: identity === 'other-member' ? otherUser : user,
        });
        const targetInvitation = admin.create(WorkspaceInvitation, {
          workspace: targetWorkspace,
          inviter: user,
          email: `${randomUUID()}@example.test`,
          expiresAt: new Date(Date.now() + 60_000),
        });
        await admin
          .persist([targetWorkspace, otherUser, targetMember, targetInvitation])
          .flush();

        const em = scoped(
          scope === 'foreign' ? current.id : targetWorkspace.id,
          identity === 'anonymous' || identity === 'workspace-key'
            ? ''
            : user.id,
        );
        if (identity === 'anonymous')
          em.setSessionContext({ role: 'anonymous' });
        if (scope === 'deleted') {
          // Simulate deletion after authentication. Child RLS only checks the
          // staged identity/workspace, not the parent's soft-delete timestamp.
          await admin.nativeUpdate(Workspace, targetWorkspace.id, {
            deletedAt: new Date(),
          });
        }
        const targetId =
          table === 'workspace_member' ? targetMember.id : targetInvitation.id;
        const read = () =>
          em.execute(`select id from ${table} where id = ?`, [targetId]);
        const update = () =>
          em.execute(
            `update ${table} set email = ? where id = ? returning id`,
            [`${randomUUID()}@example.test`, targetId],
          );
        const remove = () =>
          em.execute(`delete from ${table} where id = ? returning id`, [
            targetId,
          ]);
        const insert = () =>
          table === 'workspace_member'
            ? em.execute(
                'insert into workspace_member (workspace_id, name) values (?, ?)',
                [targetWorkspace.id, 'New member'],
              )
            : em.execute(
                'insert into workspace_invitation (id, workspace_id, inviter_id, email, expires_at) values (?, ?, ?, ?, now())',
                [
                  randomUUID(),
                  targetWorkspace.id,
                  user.id,
                  `${randomUUID()}@example.test`,
                ],
              );

        if (identity === 'anonymous') {
          for (const operation of [read, update, insert, remove]) {
            await expect(operation()).rejects.toThrow(/permission denied/i);
          }
          return;
        }

        const canWrite = scope !== 'foreign';
        const canRead =
          canWrite ||
          (scope === 'foreign' &&
            identity === 'self' &&
            table === 'workspace_member');
        expect(await read()).toHaveLength(canRead ? 1 : 0);
        expect(await update()).toHaveLength(canWrite ? 1 : 0);
        if (canWrite) await insert();
        else await expect(insert()).rejects.toThrow(/row.level security/i);
        expect(await remove()).toHaveLength(canWrite ? 1 : 0);
      },
    );

    it('does not activate a deleted workspace on a new authenticated request', async () => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, {
        name: 'Deleted before authentication',
        deletedAt: new Date(),
      });
      const member = admin.create(WorkspaceMember, {
        workspace,
        user,
        name: user.name,
      });
      await admin.persist([workspace, member]).flush();
      const em = scoped(workspace.id);
      em.setSessionContext({ role: 'anonymous' });
      const middleware = new AuthMiddleware(
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
          getSession: vi
            .fn()
            .mockResolvedValue({ user, session: new Session() }),
        } as unknown as SessionService,
        { validate: vi.fn() } as unknown as ApiKeyService,
        em,
      );
      const request = {
        headers: { 'x-workspace-id': workspace.id },
      } as unknown as Request;
      const context = new RequestContext({ type: 'http' });
      context.set(REQUEST, request);
      await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(RequestContext.get(Workspace)).toBeUndefined();
        expect(em.getSessionContext()?.variables?.['app.workspace']).toBe('');
        await expect(
          em.insert(WorkspaceMember, {
            workspace: workspace.id,
            name: 'Denied in a deleted workspace',
          }),
        ).rejects.toThrow(/row.level security/i);
      });
    });

    it('soft-deletes through the authorized service while preserving workspace-table restrictions', async () => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, { name: 'Soft deletion' });
      const owner = admin.create(WorkspaceMember, {
        workspace,
        user,
        name: user.name,
        roles: ['owner'],
      });
      const invitation = admin.create(WorkspaceInvitation, {
        workspace,
        inviter: user,
        email: 'soft-delete@example.test',
        expiresAt: new Date(Date.now() + 60_000),
      });
      await admin.persist([workspace, owner, invitation]).flush();
      const em = scoped(workspace.id);
      await expect(
        em.nativeUpdate(Workspace, workspace.id, {
          deletedAt: new Date(),
        }),
      ).rejects.toThrow(/row.level security/i);
      const result = await serviceFor(em).deleteWorkspace(workspace, owner);
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(
        await scoped(workspace.id).findOne(Workspace, workspace.id),
      ).toBeNull();
      expect(
        await em.nativeUpdate(Workspace, workspace.id, { name: 'Denied' }),
      ).toBe(0);
      expect(
        (await orm.em.fork().findOneOrFail(WorkspaceInvitation, invitation.id))
          .status,
      ).toBe('canceled');
    });
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
