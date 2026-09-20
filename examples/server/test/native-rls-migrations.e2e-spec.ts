import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';

import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { EntityManager } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/pglite';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import {
  AccessControlService,
  AuthMiddleware,
  AuthModule,
  type AuthModuleOptions,
  AuthService,
  InvitationService,
  Member as BaseMember,
  MemberService,
  MemberStatus,
  SessionService,
  UserService,
  Workspace as BaseWorkspace,
  WorkspaceService,
} from '@nest-boot/auth';
import {
  Account,
  type ApiKey,
  Invitation,
  Member,
  Session,
  User,
  UserApiKey,
  Verification,
  Workspace,
  WorkspaceApiKey,
} from '@nest-boot/auth';
import { loadConfigFromEnv } from '@nest-boot/mikro-orm';
import { REQUEST, RequestContext } from '@nest-boot/request-context';
import type { FactoryProvider } from '@nestjs/common';
import type { Request } from 'express';

import { mikroOrmAdapter } from '../../../packages/auth/dist/adapters/mikro-orm-adapter.js';
import { AUTH_TOKEN } from '../../../packages/auth/dist/auth.constants.js';
import { ApiKeyAuthenticationService } from '../../../packages/auth/dist/infrastructure/api-key-authentication.service.js';
import { createContextualAuthService } from '../../../packages/auth/dist/infrastructure/create-contextual-auth-service.js';
import { RequestIdentity } from '../../../packages/auth/dist/infrastructure/request-identity.js';
import { UserDeletionService } from '../../../packages/auth/dist/services/user-deletion.service.js';
import { Migration00000000000000_Initial } from '../src/database/migrations/Migration00000000000000_Initial.js';
import { Migration20260918091003 } from '../src/database/migrations/Migration20260918091003.js';

describe('example native RLS migrations with PGlite', () => {
  let orm: MikroORM;
  const readPolicies = (instance: MikroORM) =>
    [
      instance.getMetadata(User),
      instance.getMetadata(UserApiKey),
      instance.getMetadata(WorkspaceApiKey),
      instance.getMetadata(Workspace),
      instance.getMetadata(Member),
      instance.getMetadata(Invitation),
    ].map((metadata) => metadata.policies);
  let originalPolicies: ReturnType<typeof readPolicies>;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'memory://');
    const { metadataCache } = await loadConfigFromEnv();
    const initialize = () =>
      MikroORM.init({
        dbName: 'memory://',
        driverOptions: { extensions: { pgcrypto, uuid_ossp } },
        metadataProvider: TsMorphMetadataProvider,
        metadataCache,
        entities: [
          User,
          Account,
          Session,
          Verification,
          Workspace,
          Member,
          Invitation,
          UserApiKey,
          WorkspaceApiKey,
        ],
        extensions: [Migrator],
        migrations: {
          migrationsList: [
            Migration00000000000000_Initial,
            Migration20260918091003,
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

  it.each([false, true])(
    'revalidates request identity after a real password reset (revoke=%s)',
    async (revoke) => {
      interface ResetBackend {
        api: {
          signUpEmail(options: {
            body: { name: string; email: string; password: string };
          }): Promise<{ user: { id: string }; token: string | null }>;
          requestPasswordReset(options: {
            body: { email: string };
          }): Promise<unknown>;
          resetPassword(options: {
            body: { token: string; newPassword: string };
          }): Promise<{ status: boolean }>;
        };
      }
      let resetToken = '';
      const options: AuthModuleOptions = {
        baseURL: 'http://localhost:4100',
        secret: 'password-reset-integration-secret-long-enough',
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          revokeSessionsOnPasswordReset: revoke,
          sendResetPassword: ({ token }) => {
            resetToken = token;
            return Promise.resolve();
          },
          password: {
            hash: (value) => Promise.resolve(`test:${value}`),
            verify: ({ hash, password }) =>
              Promise.resolve(hash === `test:${password}`),
          },
        },
      };
      const providers = Reflect.getMetadata(
        'providers',
        AuthModule,
      ) as FactoryProvider<ResetBackend>[];
      const factory = providers.find(
        (provider) => provider.provide === AUTH_TOKEN,
      );
      const admin = orm.em.fork();
      const backend = factory.useFactory(
        options,
        orm,
        { sendMail: vi.fn() },
        {},
        new UserDeletionService(admin),
      ) as ResetBackend;
      const email = `${randomUUID()}@example.test`;
      const signedUp = await backend.api.signUpEmail({
        body: { name: 'Reset actor', email, password: 'old-password' },
      });
      try {
        const user = await admin.findOneOrFail(User, signedUp.user.id);
        const session = await admin.findOneOrFail(Session, {
          token: signedUp.token,
        });
        await backend.api.requestPasswordReset({ body: { email } });
        expect(resetToken).not.toBe('');
        const em = orm.em.fork({
          session: {
            role: 'authenticated',
            variables: { 'app.user.id': user.id },
          },
        });
        const access = new AccessControlService(options);
        const sessions = new SessionService(backend, em, access);
        const middleware = new AuthMiddleware(
          options,
          sessions,
          {} as never,
          em,
        );
        const service = new AuthService(
          backend,
          middleware,
          {} as never,
          sessions,
        );
        await RequestContext.run(
          new RequestContext({ type: 'test' }),
          async () => {
            RequestIdentity.stage({ user, session });
            RequestIdentity.prepare(options);
            await expect(
              service.resetPassword({
                token: resetToken,
                newPassword: 'new-password',
              }),
            ).resolves.toBe(true);
            expect(await admin.count(Session, { user })).toBe(revoke ? 0 : 1);
            expect(RequestContext.get(Session)).toBe(revoke ? null : session);
            expect(RequestContext.get(User)).toBe(revoke ? null : user);
            expect(access.can('create', Workspace)).toBe(!revoke);
            expect(em.getSessionContext()?.role).toBe(
              revoke ? 'anonymous' : 'authenticated',
            );
            if (revoke) {
              await expect(
                new WorkspaceService(em, options, access).createWorkspace(
                  user,
                  { name: 'Denied after reset' },
                ),
              ).rejects.toThrow('another user');
            }
          },
        );
      } finally {
        await admin.nativeDelete(User, signedUp.user.id);
      }
    },
  );

  it.each(['before', 'after'] as const)(
    'publishes deletion revocation only after commit when the %s hook fails',
    async (phase) => {
      const hookError = new Error(`${phase} deletion hook failed`);
      const options: AuthModuleOptions = {
        baseURL: 'http://localhost:4100',
        secret: 'delete-hook-integration-secret-long-enough',
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          password: {
            hash: (value) => Promise.resolve(`test:${value}`),
            verify: ({ hash, password }) =>
              Promise.resolve(hash === `test:${password}`),
          },
        },
        user: {
          deleteUser: {
            enabled: true,
            [phase === 'before' ? 'beforeDelete' : 'afterDelete']: () => {
              throw hookError;
            },
          },
        },
      };
      const admin = orm.em.fork();
      const em = orm.em.fork({ session: { role: 'anonymous' } });
      const factory = (
        Reflect.getMetadata('providers', AuthModule) as FactoryProvider[]
      ).find((provider) => provider.provide === AUTH_TOKEN);
      const backend = factory.useFactory(
        options,
        { em },
        { sendMail: vi.fn() },
        {},
        new UserDeletionService(admin),
      ) as {
        api: {
          signUpEmail(input: {
            body: { email: string; name: string; password: string };
            returnHeaders: true;
          }): Promise<{
            headers: Headers;
            response: { user: { id: string }; token: string };
          }>;
        };
      };
      const registered = await backend.api.signUpEmail({
        body: {
          email: `${randomUUID()}@example.test`,
          name: 'Deletion actor',
          password: 'old-password',
        },
        returnHeaders: true,
      });
      const signup = registered.response;
      const cookie = registered.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      try {
        const user = await admin.findOneOrFail(User, signup.user.id);
        const session = await admin.findOneOrFail(Session, {
          token: signup.token,
        });
        em.setSessionContext({
          role: 'authenticated',
          variables: { 'app.user.id': user.id },
        });
        const access = new AccessControlService(options);
        const sessions = new SessionService(backend, em, access);
        const middleware = new AuthMiddleware(
          options,
          sessions,
          {} as never,
          em,
        );
        const service = new AuthService(
          backend,
          middleware,
          {} as never,
          sessions,
        );
        await RequestContext.run(
          new RequestContext({ type: 'http' }),
          async () => {
            RequestContext.set(REQUEST, { headers: { cookie } });
            RequestIdentity.stage({ user, session });
            RequestIdentity.prepare(options);
            await expect(
              service.deleteCurrentUser({ password: 'old-password' }),
            ).rejects.toThrow(hookError.message);
            const deleted = phase === 'after';
            expect(await admin.count(User, user.id)).toBe(deleted ? 0 : 1);
            expect(await admin.count(Session, { user: user.id })).toBe(
              deleted ? 0 : 1,
            );
            expect(RequestContext.get(User)).toBe(deleted ? null : user);
            expect(RequestContext.get(Session)).toBe(deleted ? null : session);
            expect(access.can('create', Workspace)).toBe(!deleted);
            expect(em.getSessionContext()?.role).toBe(
              deleted ? 'anonymous' : 'authenticated',
            );
            if (deleted) {
              await expect(
                new WorkspaceService(em, options, access).createWorkspace(
                  user,
                  { name: 'Denied after deletion' },
                ),
              ).rejects.toThrow('another user');
            }
          },
        );
      } finally {
        await admin.nativeDelete(User, signup.user.id);
      }
    },
  );

  it.each([
    'sign-in',
    'social-sign-in',
    'sign-up',
    'impersonate',
    'stop-impersonating',
  ] as const)(
    'rejects %s inside a real transaction without an RLS session',
    async (operation) => {
      await orm.em.fork().transactional(async (em) => {
        expect(em.getSessionContext()).toBeUndefined();
        const middleware = new AuthMiddleware({}, {} as never, {} as never, em);
        const service = new AuthService(
          {},
          middleware,
          {} as never,
          {} as never,
        );
        const invoke = () =>
          operation === 'sign-in'
            ? service.signInEntity({
                email: 'user@example.test',
                password: 'password',
              })
            : operation === 'social-sign-in'
              ? service.signInSocialEntity({ provider: 'github' })
              : operation === 'sign-up'
                ? service.signUpPayload({
                    email: 'user@example.test',
                    name: 'User',
                    password: 'password',
                  })
                : operation === 'impersonate'
                  ? service.impersonateUser('123')
                  : service.stopImpersonating();
        await expect(invoke()).rejects.toThrow(
          'Change request authentication outside an active transaction',
        );
      });
    },
  );

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

  it('protects all auth tables with RLS and denies request access to verification tokens', async () => {
    expect(
      await orm.em.execute(
        "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'mikro_orm_migrations' and not relrowsecurity",
      ),
    ).toEqual([]);
    const admin = orm.em.fork();
    const verification = admin.create(Verification, {
      identifier: randomUUID(),
      value: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await admin.persist(verification).flush();
    try {
      for (const role of ['anonymous', 'authenticated']) {
        const em = orm.em.fork({ session: { role } });
        expect(await em.find(Verification, {})).toEqual([]);
      }
      const em = orm.em.fork({ session: { role: 'authenticated' } });
      expect(
        await em.nativeUpdate(Verification, verification.id, {
          value: 'denied',
        }),
      ).toBe(0);
      expect(await em.nativeDelete(Verification, verification.id)).toBe(0);
      await expect(
        em.insert(Verification, {
          identifier: randomUUID(),
          value: 'denied',
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(/row.level security/i);
      expect(await admin.count(Verification, verification.id)).toBe(1);
    } finally {
      await admin.nativeDelete(Verification, verification.id);
    }
  });

  it('returns scalar Better Auth userId values without initializing user relations', async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: 'Adapter owner',
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
    });
    await admin.persist(user).flush();
    const account = admin.create(Account, {
      user,
      issuer: 'adapter-test',
      accountId: user.id,
      providerId: 'credential',
    });
    const session = admin.create(Session, {
      user,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await admin.persist([account, session]).flush();
    try {
      const reader = orm.em.fork();
      const adapter = mikroOrmAdapter({
        orm: { em: reader } as MikroORM,
      })({});
      for (const model of ['account', 'session'] as const) {
        const entity =
          model === 'account'
            ? await reader.findOneOrFail(Account, account.id)
            : await reader.findOneOrFail(Session, session.id);
        expect(entity.user.id).toBe(user.id);
        expect(entity.user.isInitialized()).toBe(false);
        const found = await adapter.findOne({
          model,
          where: [{ field: 'userId', value: user.id }],
        });
        expect(found).toMatchObject({ id: entity.id, userId: user.id });
        expect(found).not.toHaveProperty('user');
        expect(entity.user.isInitialized()).toBe(false);
      }
    } finally {
      await admin.nativeDelete(User, user.id);
    }
  });

  it('delegates Session reads to Services while retaining Account ownership RLS', async () => {
    const admin = orm.em.fork();
    const users = ['RLS self', 'RLS foreign', 'RLS administrator'].map(
      (name, index) =>
        admin.create(User, {
          name,
          email: `${randomUUID()}@example.com`,
          emailVerified: true,
          roles: index === 2 ? ['admin'] : ['user'],
          permissions: [],
        }),
    );
    await admin.persist(users).flush();
    const sessions = users.slice(0, 2).map((user) =>
      admin.create(Session, {
        user,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    const accounts = users.slice(0, 2).map((user) =>
      admin.create(Account, {
        user,
        issuer: 'rls-test',
        providerId: 'credential',
        accountId: user.id,
        password: 'not-a-real-password',
      }),
    );
    await admin.persist([...sessions, ...accounts]).flush();
    const scoped = (id: string, role = 'authenticated') => {
      const em = orm.em.fork();
      em.setSessionContext({
        role,
        variables: {
          'app.user.id': id,
          'app.workspace.id': '',
        },
      });
      return em;
    };
    try {
      const sessionIds = sessions.map((s) => s.id);
      const accountIds = accounts.map((a) => a.id);
      expect(
        (
          await scoped(users[0].id).find(
            Session,
            { id: sessionIds },
            { exclude: ['token'] },
          )
        ).map((s) => s.id),
      ).toEqual(expect.arrayContaining(sessionIds));
      expect(
        await scoped('', 'anonymous').find(
          Session,
          { id: sessionIds },
          { exclude: ['token'] },
        ),
      ).toEqual([]);
      expect(await scoped(users[2].id).count(Session, { id: sessionIds })).toBe(
        2,
      );
      expect(
        (
          await scoped(users[0].id).find(
            Account,
            { id: accountIds },
            { exclude: ['password', 'accessToken', 'refreshToken', 'idToken'] },
          )
        ).map((a) => a.id),
      ).toEqual([accounts[0].id]);
      expect(await scoped(users[2].id).count(Account, { id: accountIds })).toBe(
        0,
      );
      expect(
        await scoped(users[0].id).findOne(Session, sessions[0].id),
      ).toMatchObject({ token: sessions[0].token });
      expect(
        await scoped(users[0].id).findOne(Account, accounts[0].id),
      ).toMatchObject({ password: accounts[0].password });
      expect(
        await scoped(users[0].id).nativeDelete(Session, sessions[0].id),
      ).toBe(0);
      expect(await scoped('', 'anonymous').count(Session, {})).toBe(0);
      // Removing a child through the ORM must never cascade upward to its user.
      await admin.remove(sessions[0]).flush();
      await admin.remove(accounts[0]).flush();
      expect(await admin.count(User, users[0].id)).toBe(1);
    } finally {
      await admin.nativeDelete(Account, { id: accounts.map((a) => a.id) });
      await admin.nativeDelete(Session, { id: sessions.map((s) => s.id) });
      await admin.nativeDelete(User, { id: users.map((u) => u.id) });
    }
  });

  it('enforces management writes and atomically cascades only an RLS-authorized user deletion', async () => {
    const admin = orm.em.fork();
    const [administrator, target, other] = ['admin', 'target', 'other'].map(
      (name) =>
        admin.create(User, {
          name,
          email: `${randomUUID()}@example.test`,
          emailVerified: true,
          roles: name === 'admin' ? ['admin'] : ['user'],
          permissions: [],
        }),
    );
    await admin.persist([administrator, target, other]).flush();
    const workspace = admin.create(Workspace, { name: 'Deletion fixture' });
    const member = admin.create(Member, {
      workspace,
      user: target,
      roles: ['owner'],
      name: 'Member profile',
    });
    const invitation = admin.create(Invitation, {
      workspace,
      inviter: target,
      email: 'cascade@example.test',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const account = admin.create(Account, {
      user: target,
      accountId: target.id,
      issuer: 'test',
      providerId: 'credential',
      password: 'fixture',
    });
    const session = admin.create(Session, {
      user: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const impersonation = admin.create(Session, {
      user: other,
      impersonatedBy: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const unrelatedSession = admin.create(Session, {
      user: other,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const workspaceKey = admin.create(WorkspaceApiKey, {
      workspace,
      name: 'Workspace key',
      key: randomUUID(),
    });
    const key = admin.create(UserApiKey, {
      user: target,
      name: 'Personal',
      key: randomUUID(),
    });
    const otherKey = admin.create(UserApiKey, {
      user: other,
      name: 'Unrelated',
      key: randomUUID(),
    });
    await admin
      .persist([
        workspace,
        member,
        invitation,
        account,
        session,
        impersonation,
        unrelatedSession,
        workspaceKey,
        key,
        otherKey,
      ])
      .flush();
    const scoped = (id: string) =>
      orm.em.fork({
        session: {
          role: 'authenticated',
          variables: {
            'app.user.id': id,
            'app.workspace.id': '',
          },
        },
      });
    try {
      // Database policy does not interpret application permission names.
      expect(
        await scoped(target.id).nativeUpdate(User, other.id, {
          name: 'Service-authorized write',
        }),
      ).toBe(1);
      expect(
        await scoped(administrator.id).nativeUpdate(User, target.id, {
          name: 'Managed',
        }),
      ).toBe(1);
      expect(
        await scoped(target.id).nativeUpdate(UserApiKey, key.id, {
          name: 'Scoped key',
        }),
      ).toBe(1);
      expect(
        await scoped(target.id).nativeUpdate(UserApiKey, otherKey.id, {
          name: 'Denied',
        }),
      ).toBe(0);
      expect(
        await scoped(target.id).nativeDelete(UserApiKey, otherKey.id),
      ).toBe(0);
      await expect(
        scoped(target.id).execute(
          'update user_api_key set user_id = ? where id = ?',
          [other.id, key.id],
        ),
      ).rejects.toThrow(/row.level security/i);
      expect(
        await scoped(target.id).nativeUpdate(UserApiKey, key.id, {
          key: 'replacement',
        }),
      ).toBe(1);
      expect(
        await admin.execute(
          "select proname from pg_proc where proname in ('can_read_users', 'delete_auth_user_dependants')",
        ),
      ).toEqual([]);
      await expect(
        scoped(administrator.id).transactional(async (em) => {
          expect(await em.nativeDelete(User, target.id)).toBe(1);
          throw new Error('Rollback cascade');
        }),
      ).rejects.toThrow('Rollback cascade');
      expect(await admin.count(User, target.id)).toBe(1);
      expect(await admin.count(UserApiKey, key.id)).toBe(1);
      expect(await admin.count(Session, impersonation.id)).toBe(1);
      expect(await scoped(administrator.id).nativeDelete(User, target.id)).toBe(
        1,
      );
      for (const [entity, id] of [
        [User, target.id],
        [Account, account.id],
        [Session, session.id],
        [Session, impersonation.id],
        [UserApiKey, key.id],
        [Member, member.id],
        [Invitation, invitation.id],
      ] as const) {
        expect(await admin.count<{ id: string }>(entity, { id })).toBe(0);
      }
      expect(await admin.count(UserApiKey, otherKey.id)).toBe(1);
      expect(await admin.count(WorkspaceApiKey, workspaceKey.id)).toBe(1);
      expect(await admin.count(Session, unrelatedSession.id)).toBe(1);
      const retainedWorkspace = await admin.findOneOrFail(
        Workspace,
        workspace.id,
        { refresh: true },
      );
      expect(retainedWorkspace.name).toBe('Deletion fixture');
      expect(await admin.count(Member, { workspace })).toBe(0);
    } finally {
      await admin.nativeDelete(Member, member.id);
      await admin.nativeDelete(User, {
        id: [administrator.id, target.id, other.id],
      });
      await admin.nativeDelete(Workspace, workspace.id);
    }
  });

  it('stages identities without passing application permissions to the database', async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: 'Context fixture',
      email: `${randomUUID()}@example.test`,
      emailVerified: true,
      roles: ['user'],
      permissions: ['user:read'],
    });
    const workspace = admin.create(Workspace, { name: 'Context workspace' });
    const member = admin.create(Member, {
      user,
      workspace,
      name: 'Context member',
      roles: ['member'],
      permissions: ['workspace:update'],
    });
    await admin.persist([user, workspace, member]).flush();
    const options: AuthModuleOptions = {};
    const readContext = async (authenticated: boolean) => {
      const em = orm.em.fork({ session: { role: 'anonymous' } });
      const middleware = new AuthMiddleware(
        options,
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue(
              authenticated ? { user, session: new Session() } : null,
            ),
        } as unknown as SessionService,
        { validate: vi.fn() } as unknown as ApiKeyAuthenticationService,
        em,
      );
      const request = {
        headers: { 'x-workspace-id': workspace.id },
      } as unknown as Request;
      const context = new RequestContext({ type: 'http' });
      context.set(REQUEST, request);
      return await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        const [values] = await em.execute(`select
          current_setting('app.user.id', true) as user_id,
          current_setting('app.workspace.id', true) as workspace_id,
          nullif(current_setting('app.user.permissions', true), '') as user_permissions,
          nullif(current_setting('app.workspace.permissions', true), '') as workspace_permissions`);
        return values;
      });
    };
    try {
      expect(await readContext(true)).toEqual({
        user_id: user.id,
        workspace_id: workspace.id,
        user_permissions: null,
        workspace_permissions: null,
      });
      expect(await readContext(false)).toEqual({
        user_id: '',
        workspace_id: workspace.id,
        user_permissions: null,
        workspace_permissions: null,
      });
      const [outside] = await admin.execute(`select
        nullif(current_setting('app.user.permissions', true), '') as user_permissions,
        nullif(current_setting('app.workspace.permissions', true), '') as workspace_permissions`);
      expect(outside).toEqual({
        user_permissions: null,
        workspace_permissions: null,
      });
    } finally {
      await admin.nativeDelete(User, user.id);
      await admin.nativeDelete(Workspace, workspace.id);
    }
  });

  it('creates the complete baseline through the official Migrator', async () => {
    expect(await orm.migrator.getPending()).toEqual([]);
    expect(await orm.migrator.getExecuted()).toHaveLength(2);
    const policies = await orm.em.execute<
      { policyname: string; qual: string; with_check: string }[]
    >(
      "select policyname, qual, with_check from pg_policies where qual like '%app.workspace.id%'",
    );
    expect(policies).toHaveLength(5);
    for (const policy of policies) {
      expect(policy.qual).toContain('app.workspace.id');
      expect(policy.qual).not.toContain('app.workspace_id');
      if (policy.with_check)
        expect(policy.with_check).toContain('app.workspace.id');
    }
  });

  it('matches current entity metadata immediately after migration without schema synchronization', async () => {
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
  });

  it('inherits member collections from auth base entities and resolves concrete targets', () => {
    expect(orm.getMetadata(User).properties.members.targetMeta?.class).toBe(
      Member,
    );
    expect(
      orm.getMetadata(Workspace).properties.members.targetMeta?.class,
    ).toBe(Member);
    expect(orm.getMetadata(User).properties.members.mappedBy).toBe('user');
    expect(orm.getMetadata(Workspace).properties.members.mappedBy).toBe(
      'workspace',
    );
    expect(orm.getMetadata(Workspace).properties).not.toHaveProperty(
      'features',
    );
  });

  it('matches the committed snapshot without generating another migration', async () => {
    await access('./src/database/migrations/.snapshot-postgres.json');
    expect(
      await orm.migrator.checkSchema(),
      await orm.schema.getUpdateSchemaSQL(),
    ).toBe(false);
  });

  it('generates distinct policy names for composed policies', async () => {
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace' order by policyname",
      ),
    ).toEqual([
      { policyname: 'workspace_delete_policy' },
      { policyname: 'workspace_select_policy' },
      { policyname: 'workspace_update_policy' },
    ]);
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'invitation' order by policyname",
      ),
    ).toEqual([
      { policyname: 'invitation_all_policy' },
      { policyname: 'invitation_recipient_select_policy' },
    ]);
  });

  it('keeps child policies free of parent-workspace subqueries', async () => {
    const policies = await orm.em.execute<
      { qual: string; with_check: string | null }[]
    >(
      "select qual, with_check from pg_policies where tablename in ('member', 'invitation')",
    );
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.qual).toContain('current_setting');
      expect(policy.qual).not.toMatch(/from\s+workspace\b|deleted_at/i);
      if (policy.with_check) {
        expect(policy.with_check).toContain('app.workspace.id');
        expect(policy.with_check).not.toMatch(/exists|deleted_at/i);
      }
    }
  });

  it('enforces the example policy and grants with an anonymous workspace session', async () => {
    const admin = orm.em.fork();
    await admin.insert(Workspace, { name: 'Example' });
    const em = orm.em.fork({
      session: { role: 'anonymous', variables: { 'app.workspace.id': '1' } },
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
    em.setSessionContext({ variables: { 'app.workspace.id': '2' } });
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
        await admin.insert(Member, {
          user,
          workspace,
          name: 'Member profile',
        });
      }
      const hasUser = isMember || kind === 'non-member';
      const em = orm.em.fork(
        kind === 'unconfigured-session'
          ? {}
          : {
              session: {
                role: 'anonymous',
                variables: { 'app.workspace.id': '1' },
              },
            },
      );
      const options = {} satisfies AuthModuleOptions;
      const middleware = new AuthMiddleware(
        options,
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue(
              hasUser && kind !== 'user-key'
                ? { user, session: new Session() }
                : null,
            ),
        } as unknown as SessionService,
        {
          validate: vi.fn().mockResolvedValue({
            apiKey: new WorkspaceApiKey(),
            ownerType: kind === 'user-key' ? 'user' : 'workspace',
            user,
            workspace,
          }),
        } as unknown as ApiKeyAuthenticationService,
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
            "select current_user as role, current_setting('app.user.id', true) as app_user, current_setting('app.workspace.id', true) as app_workspace",
          ),
        ).toEqual([
          {
            role: kind === 'anonymous' ? 'anonymous' : 'authenticated',
            app_user: hasUser ? user.id : '',
            app_workspace: kind === 'non-member' ? '' : '1',
          },
        ]);
        if (kind === 'anonymous') {
          expect(
            await em.nativeUpdate(Workspace, '1', { name: 'Denied' }),
          ).toBe(0);
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
    const user = admin.create(User, {
      name: 'Permission target',
      email: 'permission-target@example.test',
      emailVerified: true,
    });
    const member = admin.create(Member, {
      workspace,
      user,
      name: 'Member profile',
    });
    await admin.persist(member).flush();
    const session = {
      role: 'authenticated',
      variables: { 'app.workspace.id': workspace.id, 'app.user.id': '' },
    };
    const scoped = orm.em.fork({ session });
    const service = new MemberService(scoped, {}, {
      assertCan: vi.fn(),
      assertCurrentWorkspace: vi.fn(),
      assertCurrentMember: vi.fn(),
      assertCanGrantWorkspacePermissions: vi.fn(),
    } as unknown as AccessControlService);
    const context = new RequestContext({ type: 'test' });
    context.set(EntityManager, scoped);
    context.set(BaseWorkspace, workspace);
    context.set(
      BaseMember,
      Object.assign(new Member(), { workspace, roles: ['owner'] }),
    );

    await RequestContext.run(context, async () => {
      const pendingWorkspace = await scoped.findOneOrFail(
        Workspace,
        workspace.id,
      );
      pendingWorkspace.name = 'Unrelated pending change';
      for (const permissions of [['workspace:update'], ['member:write'], []]) {
        const detached = await service.getMember(member.id);
        expect(detached).not.toBeNull();
        const updated = await service.setMemberPermissions(
          detached,
          permissions,
        );
        expect(updated.permissions).toEqual(permissions);
        const persisted = await orm.em.fork().findOneOrFail(Member, member.id);
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
        `insert into ${ownerType}_api_key (id, ${ownerType}_id, name, key) values (?, ?, ?, ?)`,
        [id, ownerId, 'Policy probe', randomUUID()],
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
        owner instanceof User
          ? admin.create(UserApiKey, {
              user: owner,
              name: 'Owner boundary fixture',
              key: randomUUID(),
            })
          : admin.create(WorkspaceApiKey, {
              workspace: owner,
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
        `grant select, insert, update, delete on user_api_key, workspace_api_key to ${probeRole}, ${anonymousProbeRole}`,
      );
    });

    afterAll(async () => {
      const admin = orm.em.fork();
      await admin.execute(
        `revoke all on user_api_key, workspace_api_key from ${probeRole}, ${anonymousProbeRole}`,
      );
      await admin.execute(`drop role ${probeRole}, ${anonymousProbeRole}`);
      await admin.nativeDelete(UserApiKey, { id: keys.map((key) => key.id) });
      await admin.nativeDelete(WorkspaceApiKey, {
        id: keys.map((key) => key.id),
      });
      await admin.nativeDelete(User, { id: [userId, foreignId] });
      await admin.nativeDelete(Workspace, { id: [userId, foreignId] });
    });

    it.each(['user', 'workspace'])(
      'combines default grants with %s-key RLS and a required foreign key',
      async (ownerType) => {
        const table = ownerType + '_api_key';
        const em = orm.em.fork();
        expect(
          await em.execute(
            'select relrowsecurity from pg_class where oid = ?::regclass',
            [table],
          ),
        ).toEqual([{ relrowsecurity: true }]);
        for (const role of ['anonymous', 'authenticated']) {
          for (const privilege of ['select', 'insert', 'update', 'delete']) {
            expect(
              await em.execute(
                'select has_table_privilege(?, ?, ?) as allowed',
                [role, table, privilege],
              ),
            ).toEqual([{ allowed: true }]);
          }
        }
        await expect(
          em.execute(`insert into ${table} (name, key) values (?, ?)`, [
            'No owner',
            randomUUID(),
          ]),
        ).rejects.toThrow(/not-null constraint/i);
        await expect(
          insertKey(em, '900199', ownerType, '999999999'),
        ).rejects.toThrow(/foreign key constraint/i);
        const otherType = ownerType === 'user' ? 'workspace' : 'user';
        expect(
          await em.execute(
            'select column_name from information_schema.columns where table_name = ? and column_name = ?',
            [table, otherType + '_id'],
          ),
        ).toEqual([]);
      },
    );

    it('cascades workspace keys on workspace deletion', async () => {
      const em = orm.em.fork();
      const workspace = em.create(Workspace, { name: 'Cascade workspace' });
      const key = em.create(WorkspaceApiKey, {
        workspace,
        name: 'Cascade key',
        key: randomUUID(),
      });
      await em.persist(key).flush();
      expect(await em.count(WorkspaceApiKey, key.id)).toBe(1);
      await em.nativeDelete(Workspace, workspace.id, { filters: false });
      expect(await em.count(WorkspaceApiKey, key.id)).toBe(0);
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
          'app.user.id': identity.user,
          'app.workspace.id': identity.workspace,
        });
        const visibleIds = identity.visible
          .map((index) => keys[index].id)
          .sort();
        expect(
          [
            ...(await em.find(UserApiKey, {})),
            ...(await em.find(WorkspaceApiKey, {})),
          ]
            .map((key) => key.id)
            .sort(),
        ).toEqual(visibleIds);
        for (const key of keys) {
          expect(
            await em.nativeUpdate<ApiKey>(
              key instanceof UserApiKey ? UserApiKey : WorkspaceApiKey,
              key.id,
              { name: identity.name },
            ),
          ).toBe(visibleIds.includes(key.id) ? 1 : 0);
          if (!visibleIds.includes(key.id)) {
            expect(
              await em.nativeDelete<ApiKey>(
                key instanceof UserApiKey ? UserApiKey : WorkspaceApiKey,
                key.id,
              ),
            ).toBe(0);
          }
        }
      },
    );

    it('denies missing identity and anonymous access even with table privileges', async () => {
      expect(await scoped().find(UserApiKey, {})).toEqual([]);
      expect(await scoped().find(WorkspaceApiKey, {})).toEqual([]);
      const anonymous = scoped(
        { 'app.user.id': userId, 'app.workspace.id': userId },
        anonymousProbeRole,
      );
      expect(await anonymous.find(UserApiKey, {})).toEqual([]);
      expect(await anonymous.find(WorkspaceApiKey, {})).toEqual([]);
      expect(
        await anonymous.nativeUpdate(UserApiKey, keys[0].id, {
          name: 'Denied',
        }),
      ).toBe(0);
      expect(await anonymous.nativeDelete(UserApiKey, keys[0].id)).toBe(0);
      await expect(
        insertKey(anonymous, '900100', 'user', userId),
      ).rejects.toThrow(/row.level security/i);
    });

    it.each(['user', 'workspace'] as const)(
      'checks the required owner on insert and update for %s keys',
      async (ownerType) => {
        const em = scoped({
          'app.user.id': ownerType === 'user' ? userId : '',
          'app.workspace.id': ownerType === 'workspace' ? userId : '',
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
            em.execute(
              `update ${ownerType}_api_key set ${ownerType}_id = ? where id = ?`,
              [foreignId, id],
            ),
          ).rejects.toThrow(/row.level security/i);
          const stored = await em.findOneOrFail<ApiKey>(
            ownerType === 'user' ? UserApiKey : WorkspaceApiKey,
            id,
          );
          expect(
            (stored instanceof UserApiKey ? stored.user : stored.workspace)?.id,
          ).toBe(userId);
          expect(
            (stored instanceof UserApiKey
              ? stored.user
              : stored.workspace
            )?.unwrap(),
          ).toBeInstanceOf(ownerType === 'user' ? User : Workspace);
          expect(
            await em.nativeDelete<ApiKey>(
              ownerType === 'user' ? UserApiKey : WorkspaceApiKey,
              id,
            ),
          ).toBe(1);
        } finally {
          await orm.em
            .fork()
            .nativeDelete<ApiKey>(
              ownerType === 'user' ? UserApiKey : WorkspaceApiKey,
              id,
            );
        }
      },
    );
  });

  describe('workspace policy boundaries', () => {
    let user: User;
    let current: Workspace;
    let foreign: Workspace;
    let unrelated: Workspace;
    let ownMember: Member;
    let foreignMember: Member;
    let foreignInvitation: Invitation;

    const scoped = (workspaceId: string, userId = user.id) =>
      orm.em.fork({
        session: {
          role: 'authenticated',
          variables: { 'app.user.id': userId, 'app.workspace.id': workspaceId },
        },
      });
    const options = {};
    const access = {
      can: vi.fn().mockReturnValue(true),
      assertCurrentUser: vi.fn(),
      assertUserSession: vi.fn(),
      assertCan: vi.fn(),
      assertCurrentWorkspace: vi.fn(),
      assertCurrentMember: vi.fn(),
    } as unknown as AccessControlService;
    const workspaceServiceFor = (em: EntityManager) =>
      createContextualAuthService(
        em,
        (manager) => new WorkspaceService(manager, options, access),
        {
          createWorkspace: 'authentication',
        },
      );
    const invitationServiceFor = (em: EntityManager) =>
      createContextualAuthService(
        em,
        (manager) => new InvitationService(manager, options, access),
        {
          acceptInvitation: 'authentication',
          rejectInvitation: 'authentication',
        },
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
      ownMember = admin.create(Member, {
        user,
        workspace: current,
        name: 'Member profile',
      });
      foreignMember = admin.create(Member, {
        user,
        workspace: foreign,
        status: MemberStatus.DISABLED,
        name: 'Member profile',
      });
      foreignInvitation = admin.create(Invitation, {
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
        expect(await em.findOne(Member, foreignMember.id)).not.toBeNull();
        expect(
          await em.nativeUpdate(Member, foreignMember.id, {
            status: MemberStatus.ACTIVE,
          }),
        ).toBe(0);
        expect(await em.nativeDelete(Member, foreignMember.id)).toBe(0);
      },
    );

    it.each(['user', 'workspace-key'] as const)(
      'rejects cross-workspace member inserts and moves for a %s identity',
      async (identity) => {
        const em = scoped(current.id, identity === 'user' ? user.id : '');
        await expect(
          em.insert(Member, {
            user: user.id,
            workspace: unrelated.id,
            name: 'Member profile',
          }),
        ).rejects.toThrow(/row.level security/i);
        await expect(
          em.nativeUpdate(Member, ownMember.id, {
            workspace: unrelated.id,
          }),
        ).rejects.toThrow(/row.level security/i);
        expect(
          await em.nativeUpdate(Member, ownMember.id, {
            status: MemberStatus.ACTIVE,
          }),
        ).toBe(1);
      },
    );

    it.each(['user', 'workspace-key'] as const)(
      'isolates invitation reads and writes for a %s identity',
      async (identity) => {
        const em = scoped(current.id, identity === 'user' ? user.id : '');
        expect((await em.find(Invitation, {})).map(({ id }) => id)).toEqual(
          identity === 'user' ? [foreignInvitation.id] : [],
        );
        expect(
          await em.nativeUpdate(Invitation, foreignInvitation.id, {
            email: 'must-not-change@example.test',
          }),
        ).toBe(0);
        expect(await em.nativeDelete(Invitation, foreignInvitation.id)).toBe(0);
        await expect(
          em.insert(Invitation, {
            id: randomUUID(),
            workspace: foreign.id,
            inviter: user.id,
            email: `${identity}@example.test`,
            expiresAt: new Date(),
          }),
        ).rejects.toThrow(/row.level security/i);

        const id = await em.insert(Invitation, {
          id: randomUUID(),
          workspace: current.id,
          inviter: user.id,
          email: `${identity}@example.test`,
          expiresAt: new Date(),
        });
        expect(await em.findOne(Invitation, id)).not.toBeNull();
        await expect(
          em.nativeUpdate(Invitation, id, {
            workspace: foreign.id,
          }),
        ).rejects.toThrow(/row.level security/i);
        expect(
          await em.nativeUpdate(Invitation, id, {
            email: `updated-${identity}@example.test`,
          }),
        ).toBe(1);
        expect(await em.nativeDelete(Invitation, id)).toBe(1);
      },
    );

    it('permits recipient reads without workspace membership while denying unrelated identities and writes', async () => {
      const em = scoped('');
      expect((await em.find(Invitation, {})).map(({ id }) => id)).toEqual([
        foreignInvitation.id,
      ]);
      expect(await em.nativeDelete(Invitation, foreignInvitation.id)).toBe(0);
      const service = invitationServiceFor(em);
      expect((await service.getInvitation(foreignInvitation.id))?.id).toBe(
        foreignInvitation.id,
      );
      expect(
        await invitationServiceFor(scoped('', '')).getInvitation(
          foreignInvitation.id,
        ),
      ).toBeNull();
      expect(
        await invitationServiceFor(scoped('', '999999999')).getInvitation(
          foreignInvitation.id,
        ),
      ).toBeNull();
      expect(
        (
          await service.getInvitationConnectionByUser(user, {
            first: 20,
          })
        ).edges.map(({ node }) => node.id),
      ).toContain(foreignInvitation.id);
      // Even an authorized service caller cannot override the database identity.
      const hidden = await invitationServiceFor(
        scoped('', '999999999'),
      ).getInvitationConnectionByUser(user, { first: 20 });
      expect(hidden.edges).toEqual([]);
      expect(hidden.totalCount).toBe(0);
      expect(em.getSessionContext()?.variables?.['app.workspace.id']).toBe('');
    });

    it('creates a workspace and owner in an isolated transaction before selecting a workspace', async () => {
      const em = scoped('');
      const pendingUser = await em.findOneOrFail(User, user.id);
      pendingUser.name = 'Unrelated pending change';
      const context = new RequestContext({ type: 'test' });
      context.set(EntityManager, em);
      const workspace = await RequestContext.run(context, async () => {
        const result = await workspaceServiceFor(em).createWorkspace(
          pendingUser,
          {
            name: 'Created via service',
          },
        );
        expect(RequestContext.get(EntityManager)).toBe(em);
        return result;
      });
      const admin = orm.em.fork();
      const owner = await admin.findOneOrFail(Member, {
        user: user.id,
        workspace: workspace.id,
      });
      expect(owner.roles).toEqual(['owner']);
      expect(owner.status).toBe(MemberStatus.ACTIVE);
      expect((await admin.findOneOrFail(User, user.id)).name).toBe(
        'Policy user',
      );
      expect(em.getSessionContext()?.variables?.['app.workspace.id']).toBe('');
    });

    it('rolls back workspace creation when owner membership persistence fails', async () => {
      const em = scoped('');
      const name = 'Must roll back';
      await expect(
        workspaceServiceFor(em).createWorkspace(
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
      ).rejects.toThrow(/row.level security/i);
      // Check SQL without RETURNING too: no request-role INSERT policy exists.
      await expect(
        em.execute('insert into workspace (name) values (?)', [
          'Direct insert without returning is denied',
        ]),
      ).rejects.toThrow(/row.level security/i);
    });

    const accessMatrix = (
      ['anonymous', 'self', 'other-member', 'workspace-key'] as const
    ).flatMap((identity) =>
      (['current', 'foreign', 'deleted'] as const).flatMap((scope) =>
        (['member', 'invitation'] as const).map((table) => ({
          identity,
          scope,
          table,
        })),
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
        const targetMember = admin.create(Member, {
          workspace: targetWorkspace,
          user: identity === 'other-member' ? otherUser : user,
          name: 'Member profile',
        });
        const targetInvitation = admin.create(Invitation, {
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
          // Simulate deletion after authentication; foreign keys remove all children.
          await admin.nativeDelete(Workspace, targetWorkspace.id);
        }
        const targetId =
          table === 'member' ? targetMember.id : targetInvitation.id;
        const read = () =>
          em.execute(`select id from ${table} where id = ?`, [targetId]);
        const update = () =>
          em.execute(
            `update ${table} set status = status where id = ? returning id`,
            [targetId],
          );
        const remove = () =>
          em.execute(`delete from ${table} where id = ? returning id`, [
            targetId,
          ]);
        const insert = () =>
          table === 'member'
            ? em.execute(
                'insert into member (workspace_id, user_id, name) values (?, ?, ?)',
                [
                  targetWorkspace.id,
                  identity === 'other-member' ? user.id : otherUser.id,
                  'New member',
                ],
              )
            : em.execute(
                'insert into invitation (id, workspace_id, inviter_id, email, expires_at) values (?, ?, ?, ?, now())',
                [
                  randomUUID(),
                  targetWorkspace.id,
                  user.id,
                  `${randomUUID()}@example.test`,
                ],
              );

        if (identity === 'anonymous') {
          expect(await read()).toEqual([]);
          expect(await update()).toEqual([]);
          expect(await remove()).toEqual([]);
          await expect(insert()).rejects.toThrow(/row.level security/i);
          return;
        }

        if (scope === 'deleted') {
          expect(await read()).toEqual([]);
          expect(await update()).toEqual([]);
          expect(await remove()).toEqual([]);
          await expect(insert()).rejects.toThrow(/foreign key/i);
          return;
        }
        const canWrite = scope !== 'foreign';
        const canRead =
          canWrite ||
          (scope === 'foreign' && identity === 'self' && table === 'member');
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
      });
      const member = admin.create(Member, {
        workspace,
        user,
        name: 'Member profile',
      });
      await admin.persist([workspace, member]).flush();
      await admin.nativeDelete(Workspace, workspace.id);
      const em = scoped(workspace.id);
      em.setSessionContext({ role: 'anonymous' });
      const middleware = new AuthMiddleware(
        {},
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue({ user, session: new Session() }),
        } as unknown as SessionService,
        { validate: vi.fn() } as unknown as ApiKeyAuthenticationService,
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
        expect(em.getSessionContext()?.variables?.['app.workspace.id']).toBe(
          '',
        );
        await expect(
          em.insert(Member, {
            workspace: workspace.id,
            name: 'Member profile',
          }),
        ).rejects.toThrow(/row.level security/i);
      });
    });

    it('permanently deletes through the authorized service with scoped RLS and foreign-key cascades', async () => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, { name: 'Permanent deletion' });
      const owner = admin.create(Member, {
        workspace,
        user,
        roles: ['owner'],
        name: 'Member profile',
      });
      const invitation = admin.create(Invitation, {
        workspace,
        inviter: user,
        email: 'permanent-delete@example.test',
        expiresAt: new Date(Date.now() + 60_000),
      });
      await admin.persist([workspace, owner, invitation]).flush();
      const em = scoped(workspace.id);
      const result = await workspaceServiceFor(em).deleteWorkspace(workspace);
      expect(result.id).toBe(workspace.id);
      expect(await admin.count(Workspace, workspace.id)).toBe(0);
      expect(await admin.count(Member, owner.id)).toBe(0);
      expect(await admin.count(User, user.id)).toBe(1);
      expect(
        await scoped(workspace.id).findOne(Workspace, workspace.id),
      ).toBeNull();
      expect(
        await em.nativeUpdate(Workspace, workspace.id, { name: 'Denied' }),
      ).toBe(0);
      expect(await admin.count(Invitation, invitation.id)).toBe(0);
    });
  });

  it('allows authenticated User reads independently of permission names but denies anonymous reads', async () => {
    const admin = orm.em.fork();
    const viewer = admin.create(User, {
      name: 'Viewer private',
      email: 'rls-viewer@example.test',
      emailVerified: true,
    });
    const target = admin.create(User, {
      name: 'Target private',
      email: 'rls-target@example.test',
      emailVerified: true,
    });
    const workspace = admin.create(Workspace, {
      name: 'Private profile boundary',
    });
    const owner = admin.create(Member, {
      name: 'Visible owner',
      email: 'owner-contact@example.test',
      user: viewer,
      workspace,
      roles: ['owner'],
    });
    const member = admin.create(Member, {
      name: 'Visible member',
      email: 'member-contact@example.test',
      user: target,
      workspace,
    });
    await admin.persist([viewer, target, workspace, owner, member]).flush();
    const scoped = (id: string) =>
      orm.em.fork({
        session: {
          role: 'authenticated',
          variables: {
            'app.user.id': id,
            'app.workspace.id': workspace.id,
          },
        },
      });
    for (const id of [viewer.id, '']) {
      const em = scoped(id);
      expect(await em.findOne(User, target.id)).not.toBeNull();
      expect(await em.findOne(User, { email: target.email })).not.toBeNull();
      expect(await em.findOne(Member, member.id)).toMatchObject({
        name: 'Visible member',
        email: 'member-contact@example.test',
      });
    }
    expect(await scoped(viewer.id).findOne(User, viewer.id)).not.toBeNull();
    for (const permission of ['user:read', 'account-admin:view']) {
      await admin.nativeUpdate(User, viewer.id, { permissions: [permission] });
      expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    }
    await admin.nativeUpdate(User, viewer.id, {
      permissions: [],
      roles: ['admin'],
    });
    // User profile authorization belongs to Services, not the SELECT policy.
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    await admin.nativeUpdate(User, viewer.id, { roles: ['user'] });
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    const anonymous = orm.em.fork({ session: { role: 'anonymous' } });
    expect(await anonymous.findOne(User, target.id)).toBeNull();

    const options: AuthModuleOptions = {
      buildAbility: (rules) => {
        rules.cannot(['read'], User, { id: { $ne: target.id } });
      },

      user: {
        permissions: ['account-admin:view'],
        roles: { user: [] },
      },
    };
    const service = new UserService(
      scoped(viewer.id),
      options,
      {} as never,
      new AccessControlService(options),
      {} as never,
    );
    await RequestContext.run(new RequestContext({ type: 'test' }), async () => {
      viewer.roles = ['user'];
      viewer.permissions = ['account-admin:view', 'user:read'];
      RequestContext.set(User, viewer);
      RequestIdentity.refresh(options);
      expect(await service.getUser(target.id)).toMatchObject({
        email: target.email,
      });
      expect(await service.getUserByEmail(target.email)).toMatchObject({
        id: target.id,
      });
      expect(
        (
          await service.getUserConnection({
            first: 10,
            filter: { id: target.id },
          })
        ).edges.map(({ node }) => node.id),
      ).toContain(target.id);
      // Class-level grants must not bypass conditional profile authorization.
      await expect(service.getUser(viewer.id)).rejects.toThrow('not allowed');
      await expect(service.getUserByEmail(viewer.email)).rejects.toThrow(
        'not allowed',
      );
      viewer.permissions = [];
      RequestIdentity.refresh(options);
      await expect(service.getUser(target.id)).rejects.toThrow('not allowed');
      await expect(service.getUserConnection({ first: 10 })).rejects.toThrow(
        'not allowed',
      );
    });
  });

  it('authorizes User writes and cross-user Session reads through built-in grants in Services', async () => {
    const admin = orm.em.fork();
    const actor = admin.create(User, {
      name: 'Custom administrator',
      emailVerified: true,
      email: `${randomUUID()}@example.test`,
      roles: ['user'],
      permissions: ['account-admin:manage'],
    });
    const target = admin.create(User, {
      name: 'Target',
      emailVerified: true,
      email: `${randomUUID()}@example.test`,
    });
    const session = admin.create(Session, {
      user: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await admin.persist([actor, target, session]).flush();
    const options: AuthModuleOptions = {
      user: {
        permissions: ['account-admin:manage'],
        roles: { user: [] },
      },
    };
    const em = orm.em.fork({
      session: {
        role: 'authenticated',
        variables: { 'app.user.id': actor.id },
      },
    });
    const access = new AccessControlService(options);
    const users = new UserService(
      em,
      options,
      {} as never,
      access,
      new UserDeletionService(em),
    );
    const sessions = new SessionService({}, em, access);
    try {
      await RequestContext.run(
        new RequestContext({ type: 'test' }),
        async () => {
          RequestContext.set(User, actor);
          const authorize = () => {
            RequestIdentity.refresh(options);
          };
          actor.permissions = ['account-admin:manage'];
          authorize();
          await expect(
            users.updateUser(target.id, { name: 'Denied' }),
          ).rejects.toThrow('not allowed');
          await expect(users.deleteUser(target.id)).rejects.toThrow(
            'not allowed',
          );
          await expect(
            sessions.getSessionConnectionByUser(target, { first: 10 }),
          ).rejects.toThrow('not allowed');
          actor.permissions = ['user:update', 'user:delete', 'session:read'];
          authorize();
          expect(
            await users.updateUser(target.id, { name: 'Allowed' }),
          ).toMatchObject({ name: 'Allowed' });
          expect(
            (
              await sessions.getSessionConnectionByUser(target, { first: 10 })
            ).edges.map(({ node }) => node.id),
          ).toEqual([session.id]);
          expect(await users.deleteUser(target.id)).toMatchObject({
            id: target.id,
          });
          expect(await admin.count(User, target.id)).toBe(0);
          expect(await admin.count(Session, session.id)).toBe(0);
          expect(em.getSessionContext()?.variables).toEqual({
            'app.user.id': actor.id,
          });
        },
      );
    } finally {
      await admin.nativeDelete(User, { id: [actor.id, target.id] });
    }
  });

  it('requires user-backed members with independent workspace-visible profiles', async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: 'Private user',
      email: 'baseline-user@example.test',
      emailVerified: true,
    });
    const workspace = admin.create(Workspace, { name: 'Baseline membership' });
    await admin.persist([user, workspace]).flush();
    const member = admin.create(Member, {
      user,
      workspace,
      name: 'Shared member',
      email: 'shared@example.test',
    });
    await admin.persist(member).flush();
    expect(await admin.findOneOrFail(Member, member.id)).toMatchObject({
      name: 'Shared member',
      email: 'shared@example.test',
      user: { id: user.id },
    });
    for (const [sql, params] of [
      [
        'insert into member (workspace_id, name) values (?, ?)',
        [workspace.id, 'Missing user'],
      ],
      [
        'insert into member (workspace_id, user_id) values (?, ?)',
        [workspace.id, user.id],
      ],
    ] as const) {
      await expect(admin.execute(sql, [...params])).rejects.toThrow(
        /not-null constraint/i,
      );
    }
    expect(
      await admin.execute(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'member' and column_name in ('type', 'searchable_name')",
      ),
    ).toEqual([]);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe('');
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
        "select to_regclass('public.user_api_key') as user_key, to_regclass('public.workspace_api_key') as workspace_key",
      ),
    ).toEqual([{ user_key: null, workspace_key: null }]);
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
