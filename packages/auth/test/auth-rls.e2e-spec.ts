import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { EntityManager, ref } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
import { type FactoryProvider, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";

import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { ApiKeyAuthenticationService } from "../src/api-key/services/api-key-authentication.service.js";
import { mikroOrmAdapter } from "../src/core/adapters/mikro-orm-adapter.js";
import { AUTH_TOKEN } from "../src/core/constants/auth.constants.js";
import { UserDeletionService } from "../src/core/services/user-deletion.service.js";
import { entities, workspaceEntities } from "../src/index.js";
import {
  Account,
  AuthMiddleware,
  AuthModule,
  type AuthModuleOptions,
  AuthService,
  can,
  Session,
  SessionService,
  User,
  UserApiKey,
  UserService,
  Verification,
  Workspace as BaseWorkspace,
  Workspace,
  WorkspaceApiKey,
  WorkspaceApiKeyService,
  WorkspaceInvitation,
  WorkspaceInvitationService,
  WorkspaceMember as BaseWorkspaceMember,
  WorkspaceMember,
  WorkspaceMemberService,
  WorkspaceMemberStatus,
  WorkspaceMemberType,
  WorkspaceService,
} from "../src/index.js";
import { createTestApiKeyService } from "./fixtures/auth-context.fixture.js";
import { stageIdentity } from "./fixtures/auth-context.fixture.js";
import { createTestAuthContext } from "./fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

describe("Auth services and native RLS boundaries", () => {
  let orm: MikroORM;
  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      metadataProvider,
      metadataCache: { enabled: false },
      dbName: "memory://",
      entities: [...entities, ...workspaceEntities],
    });
    await orm.em.execute("create role anonymous nologin noinherit");
    await orm.em.execute("create role authenticated nologin noinherit");
    await orm.em.execute("grant anonymous, authenticated to current_user");
    await orm.em.execute(
      "grant usage on schema public to anonymous, authenticated",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on tables to anonymous, authenticated",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on sequences to anonymous, authenticated",
    );
    await orm.schema.create();
    await orm.em.fork().insert(Workspace, {
      id: "1",
      name: "Workspace boundary fixture",
    });
  }, 30000);
  afterAll(async () => {
    await orm?.close();
  });
  it.each([false, true])(
    "revalidates request identity after a real password reset (revoke=%s)",
    async (revoke) => {
      interface ResetBackend {
        api: {
          signUpEmail(options: {
            body: {
              name: string;
              email: string;
              password: string;
            };
          }): Promise<{
            user: {
              id: string;
            };
            token: string | null;
          }>;
          requestPasswordReset(options: {
            body: {
              email: string;
            };
          }): Promise<unknown>;
          resetPassword(options: {
            body: {
              token: string;
              newPassword: string;
            };
          }): Promise<{
            status: boolean;
          }>;
        };
      }
      let resetToken = "";
      const options: AuthModuleOptions = {
        workspace: { enabled: true },
        baseURL: "http://localhost:4100",
        secret: "password-reset-integration-secret-long-enough",
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
        "providers",
        AuthModule,
      ) as FactoryProvider<ResetBackend>[];
      const factory = providers.find(
        (provider) => provider.provide === AUTH_TOKEN,
      );
      const admin = orm.em.fork();
      assert(factory);
      const backend = factory.useFactory(
        options,
        orm,
        { sendMail: vi.fn() },
        {},
        new UserDeletionService(admin),
        createTestAuthContext(orm?.em, options),
      ) as ResetBackend;
      const email = `${randomUUID()}@example.test`;
      const signedUp = await backend.api.signUpEmail({
        body: { name: "Reset actor", email, password: "old-password" },
      });
      try {
        const user = await admin.findOneOrFail(User, signedUp.user.id);
        const session = await admin.findOneOrFail(Session, {
          token: signedUp.token,
        });
        await backend.api.requestPasswordReset({ body: { email } });
        expect(resetToken).not.toBe("");
        const em = orm.em.fork({
          session: {
            role: "authenticated",
            variables: { "app.user.id": user.id },
          },
        });
        const sessions = new SessionService(
          backend,
          em,
          createTestAuthContext(em, {}),
        );
        const middleware = new AuthMiddleware(
          withAuthTestFeatures(options),
          sessions,
          {} as never,
          em,
          createTestAuthContext(em, withAuthTestFeatures(options)),
        );
        const service = new AuthService(
          backend,
          middleware,
          {} as never,
          sessions,
        );
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            stageIdentity({ user, session });
            createTestAuthContext(
              undefined,
              withAuthTestFeatures(options),
            ).getAbility();
            await expect(
              service.resetPassword({
                token: resetToken,
                newPassword: "new-password",
              }),
            ).resolves.toBe(true);
            expect(await admin.count(Session, { user })).toBe(revoke ? 0 : 1);
            expect(RequestContext.get(Session)).toBe(revoke ? null : session);
            expect(RequestContext.get(User)).toBe(revoke ? null : user);
            if (revoke) {
              expect(() => can("create", Workspace)).toThrow(
                ForbiddenException,
              );
            } else {
              expect(can("create", Workspace)).toBe(true);
            }
            expect(em.getSessionContext()?.role).toBe(
              revoke ? "anonymous" : "authenticated",
            );
            if (revoke) {
              await expect(
                new WorkspaceService(
                  em,
                  options,
                  createTestAuthContext(em, options),
                ).createWorkspace(user, {
                  name: "Denied after reset",
                }),
              ).rejects.toThrow("another user");
            }
          },
        );
      } finally {
        await admin.nativeDelete(User, signedUp.user.id);
      }
    },
  );

  it.each(["before", "after"] as const)(
    "publishes deletion revocation only after commit when the %s hook fails",
    async (phase) => {
      const hookError = new Error(`${phase} deletion hook failed`);
      const options: AuthModuleOptions = {
        workspace: { enabled: true },
        baseURL: "http://localhost:4100",
        secret: "delete-hook-integration-secret-long-enough",
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
            [phase === "before" ? "beforeDelete" : "afterDelete"]: () => {
              throw hookError;
            },
          },
        },
      };
      const admin = orm.em.fork();
      const em = orm.em.fork({ session: { role: "anonymous" } });
      const factory = (
        Reflect.getMetadata("providers", AuthModule) as FactoryProvider[]
      ).find((provider) => provider.provide === AUTH_TOKEN);
      assert(factory);
      const backend = factory.useFactory(
        options,
        { em },
        { sendMail: vi.fn() },
        {},
        new UserDeletionService(admin),
        createTestAuthContext({ em }?.em, options),
      ) as {
        api: {
          signUpEmail(input: {
            body: {
              email: string;
              name: string;
              password: string;
            };
            returnHeaders: true;
          }): Promise<{
            headers: Headers;
            response: {
              user: {
                id: string;
              };
              token: string;
            };
          }>;
        };
      };
      const registered = await backend.api.signUpEmail({
        body: {
          email: `${randomUUID()}@example.test`,
          name: "Deletion actor",
          password: "old-password",
        },
        returnHeaders: true,
      });
      const signup = registered.response;
      const cookie = registered.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      try {
        const user = await admin.findOneOrFail(User, signup.user.id);
        const session = await admin.findOneOrFail(Session, {
          token: signup.token,
        });
        em.setSessionContext({
          role: "authenticated",
          variables: { "app.user.id": user.id },
        });
        const sessions = new SessionService(
          backend,
          em,
          createTestAuthContext(em, {}),
        );
        const middleware = new AuthMiddleware(
          withAuthTestFeatures(options),
          sessions,
          {} as never,
          em,
          createTestAuthContext(em, withAuthTestFeatures(options)),
        );
        const service = new AuthService(
          backend,
          middleware,
          {} as never,
          sessions,
        );
        await RequestContext.run(
          new RequestContext({ type: "http" }),
          async () => {
            RequestContext.set(REQUEST, { headers: { cookie } });
            stageIdentity({ user, session });
            createTestAuthContext(
              undefined,
              withAuthTestFeatures(options),
            ).getAbility();
            await expect(
              service.deleteCurrentUser({ password: "old-password" }),
            ).rejects.toThrow(hookError.message);
            const deleted = phase === "after";
            expect(await admin.count(User, user.id)).toBe(deleted ? 0 : 1);
            expect(await admin.count(Session, { user: user.id })).toBe(
              deleted ? 0 : 1,
            );
            expect(RequestContext.get(User)).toBe(deleted ? null : user);
            expect(RequestContext.get(Session)).toBe(deleted ? null : session);
            if (deleted) {
              expect(() => can("create", Workspace)).toThrow(
                ForbiddenException,
              );
            } else {
              expect(can("create", Workspace)).toBe(true);
            }
            expect(em.getSessionContext()?.role).toBe(
              deleted ? "anonymous" : "authenticated",
            );
            if (deleted) {
              await expect(
                new WorkspaceService(
                  em,
                  options,
                  createTestAuthContext(em, options),
                ).createWorkspace(user, {
                  name: "Denied after deletion",
                }),
              ).rejects.toThrow("another user");
            }
          },
        );
      } finally {
        await admin.nativeDelete(User, signup.user.id);
      }
    },
  );

  it.each([
    "sign-in",
    "social-sign-in",
    "sign-up",
    "impersonate",
    "stop-impersonating",
  ] as const)(
    "rejects %s inside a real transaction without an RLS session",
    async (operation) => {
      await orm.em.fork().transactional(async (em) => {
        expect(em.getSessionContext()).toBeUndefined();
        const middleware = new AuthMiddleware(
          withAuthTestFeatures({}),
          {} as never,
          {} as never,
          em,
          createTestAuthContext(em, withAuthTestFeatures({})),
        );
        const service = new AuthService(
          {},
          middleware,
          {} as never,
          {} as never,
        );
        const invoke = () =>
          operation === "sign-in"
            ? service.signInEntity({
                email: "user@example.test",
                password: "password",
              })
            : operation === "social-sign-in"
              ? service.signInSocialEntity({ provider: "github" })
              : operation === "sign-up"
                ? service.signUpPayload({
                    email: "user@example.test",
                    name: "User",
                    password: "password",
                  })
                : operation === "impersonate"
                  ? service.impersonateUser("123")
                  : service.stopImpersonating();
        await expect(invoke()).rejects.toThrow(
          "Change request authentication outside an active transaction",
        );
      });
    },
  );

  it("protects all auth tables with RLS and denies request access to verification tokens", async () => {
    expect(
      await orm.em.execute(
        "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname not in ('mikro_orm_migrations', 'job') and not relrowsecurity",
      ),
    ).toEqual([]);
    const admin = orm.em.fork();
    const verification = admin.create(Verification, {
      identifier: randomUUID(),
      value: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await admin.persist(verification).flush();
    try {
      for (const role of ["anonymous", "authenticated"]) {
        const em = orm.em.fork({ session: { role } });
        expect(await em.find(Verification, {})).toEqual([]);
      }
      const em = orm.em.fork({ session: { role: "authenticated" } });
      expect(
        await em.nativeUpdate(Verification, verification.id, {
          value: "denied",
        }),
      ).toBe(0);
      expect(await em.nativeDelete(Verification, verification.id)).toBe(0);
      await expect(
        em.insert(Verification, {
          identifier: randomUUID(),
          value: "denied",
          expiresAt: new Date(),
        }),
      ).rejects.toThrow(/row.level security/i);
      expect(await admin.count(Verification, verification.id)).toBe(1);
    } finally {
      await admin.nativeDelete(Verification, verification.id);
    }
  });

  it("returns scalar Better Auth userId values without initializing user relations", async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: "Adapter owner",
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
    });
    await admin.persist(user).flush();
    const account = admin.create(Account, {
      user,
      issuer: "adapter-test",
      accountId: user.id,
      providerId: "credential",
    });
    const session = admin.create(Session, {
      user,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await admin.persist([account, session]).flush();
    try {
      const reader = orm.em.fork();
      const adapter = mikroOrmAdapter({
        orm: { em: reader } as MikroORM,
      })({});
      for (const model of ["account", "session"] as const) {
        const entity =
          model === "account"
            ? await reader.findOneOrFail(Account, account.id)
            : await reader.findOneOrFail(Session, session.id);
        expect(entity.user.id).toBe(user.id);
        expect(entity.user.isInitialized()).toBe(false);
        const found = await adapter.findOne({
          model,
          where: [{ field: "userId", value: user.id }],
        });
        expect(found).toMatchObject({ id: entity.id, userId: user.id });
        expect(found).not.toHaveProperty("user");
        expect(entity.user.isInitialized()).toBe(false);
      }
    } finally {
      await admin.nativeDelete(User, user.id);
    }
  });

  it("delegates Session reads to Services while retaining Account ownership RLS", async () => {
    const admin = orm.em.fork();
    const users = ["RLS self", "RLS foreign", "RLS administrator"].map(
      (name, index) =>
        admin.create(User, {
          name,
          email: `${randomUUID()}@example.com`,
          emailVerified: true,
          roles: index === 2 ? ["admin"] : ["user"],
          permissions: [],
        }),
    );
    await admin.persist(users).flush();
    const sessions = users.slice(0, 2).map((user) =>
      admin.create(Session, {
        user,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
      }),
    );
    const accounts = users.slice(0, 2).map((user) =>
      admin.create(Account, {
        user,
        issuer: "rls-test",
        providerId: "credential",
        accountId: user.id,
        password: "not-a-real-password",
      }),
    );
    await admin.persist([...sessions, ...accounts]).flush();
    const scoped = (id: string, role = "authenticated") => {
      const em = orm.em.fork();
      em.setSessionContext({
        role,
        variables: {
          "app.user.id": id,
          "app.workspace.id": "",
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
            { exclude: ["token"] },
          )
        ).map((s) => s.id),
      ).toEqual(expect.arrayContaining(sessionIds));
      expect(
        await scoped("", "anonymous").find(
          Session,
          { id: sessionIds },
          { exclude: ["token"] },
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
            { exclude: ["password", "accessToken", "refreshToken", "idToken"] },
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
      expect(await scoped("", "anonymous").count(Session, {})).toBe(0);
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

  it("enforces management writes and atomically cascades only an RLS-authorized user deletion", async () => {
    const admin = orm.em.fork();
    const [administrator, target, other] = ["admin", "target", "other"].map(
      (name) =>
        admin.create(User, {
          name,
          email: `${randomUUID()}@example.test`,
          emailVerified: true,
          roles: name === "admin" ? ["admin"] : ["user"],
          permissions: [],
        }),
    );
    await admin.persist([administrator, target, other]).flush();
    const workspace = admin.create(Workspace, { name: "Deletion fixture" });
    const member = admin.create(WorkspaceMember, {
      workspace,
      user: target,
      roles: ["owner"],
      name: "WorkspaceMember profile",
    });
    const invitation = admin.create(WorkspaceInvitation, {
      workspace,
      inviter: target,
      email: "cascade@example.test",
      expiresAt: new Date(Date.now() + 60000),
    });
    const account = admin.create(Account, {
      user: target,
      accountId: target.id,
      issuer: "test",
      providerId: "credential",
      password: "fixture",
    });
    const session = admin.create(Session, {
      user: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    const impersonation = admin.create(Session, {
      user: other,
      impersonatedBy: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    const unrelatedSession = admin.create(Session, {
      user: other,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    const memberKey = admin.create(ApiKey, {
      owner: member,
      name: "Workspace key",
      key: randomUUID(),
    });
    const key = admin.create(ApiKey, {
      owner: target,
      name: "Personal",
      key: randomUUID(),
    });
    const otherKey = admin.create(ApiKey, {
      owner: other,
      name: "Unrelated",
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
        memberKey,
        key,
        otherKey,
      ])
      .flush();
    const scoped = (id: string) =>
      orm.em.fork({
        session: {
          role: "authenticated",
          variables: {
            "app.user.id": id,
            "app.workspace.id": "",
          },
        },
      });
    try {
      // Database policy does not interpret application permission names.
      expect(
        await scoped(target.id).nativeUpdate(User, other.id, {
          name: "Service-authorized write",
        }),
      ).toBe(1);
      expect(
        await scoped(administrator.id).nativeUpdate(User, target.id, {
          name: "Managed",
        }),
      ).toBe(1);
      expect(
        await scoped(target.id).nativeUpdate(ApiKey, key.id, {
          name: "Scoped key",
        }),
      ).toBe(1);
      expect(
        await scoped(target.id).nativeUpdate(ApiKey, otherKey.id, {
          name: "Denied",
        }),
      ).toBe(0);
      expect(await scoped(target.id).nativeDelete(ApiKey, otherKey.id)).toBe(0);
      await expect(
        scoped(target.id).execute(
          "update api_key set owner_id = ? where id = ?",
          [other.id, key.id],
        ),
      ).rejects.toThrow(/row.level security/i);
      expect(
        await scoped(target.id).nativeUpdate(ApiKey, key.id, {
          key: "replacement",
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
          throw new Error("Rollback cascade");
        }),
      ).rejects.toThrow("Rollback cascade");
      expect(await admin.count(User, target.id)).toBe(1);
      expect(await admin.count(ApiKey, key.id)).toBe(1);
      expect(await admin.count(Session, impersonation.id)).toBe(1);
      expect(await scoped(administrator.id).nativeDelete(User, target.id)).toBe(
        1,
      );
      for (const [entity, id] of [
        [User, target.id],
        [Account, account.id],
        [Session, session.id],
        [Session, impersonation.id],
        [WorkspaceMember, member.id],
        [WorkspaceInvitation, invitation.id],
      ] as const) {
        expect(
          await admin.count<{
            id: string;
          }>(entity, { id }),
        ).toBe(0);
      }
      expect(await admin.count(ApiKey, otherKey.id)).toBe(1);
      expect(await admin.count(ApiKey, key.id)).toBe(1);
      expect(await admin.count(ApiKey, memberKey.id)).toBe(1);
      expect(await admin.count(Session, unrelatedSession.id)).toBe(1);
      const retainedWorkspace = await admin.findOneOrFail(
        Workspace,
        workspace.id,
        { refresh: true },
      );
      expect(retainedWorkspace.name).toBe("Deletion fixture");
      expect(await admin.count(WorkspaceMember, { workspace })).toBe(0);
    } finally {
      await admin.nativeDelete(WorkspaceMember, member.id);
      await admin.nativeDelete(User, {
        id: [administrator.id, target.id, other.id],
      });
      await admin.nativeDelete(Workspace, workspace.id);
    }
  });

  it("stages identities without passing application permissions to the database", async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: "Context fixture",
      email: `${randomUUID()}@example.test`,
      emailVerified: true,
      roles: ["user"],
      permissions: ["user:read"],
    });
    const workspace = admin.create(Workspace, { name: "Context workspace" });
    const member = admin.create(WorkspaceMember, {
      user,
      workspace,
      name: "Context member",
      roles: ["member"],
      permissions: ["workspace:update"],
    });
    await admin.persist([user, workspace, member]).flush();
    const options: AuthModuleOptions = { workspace: { enabled: true } };
    const readContext = async (authenticated: boolean) => {
      const em = orm.em.fork({ session: { role: "anonymous" } });
      const middleware = new AuthMiddleware(
        withAuthTestFeatures(options),
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue(
              authenticated ? { user, session: new Session() } : null,
            ),
        } as unknown as SessionService,
        { validate: vi.fn() } as unknown as ApiKeyAuthenticationService,
        em,
        createTestAuthContext(em, withAuthTestFeatures(options)),
      );
      const request = {
        headers: { "x-workspace-id": workspace.id },
      } as unknown as Request;
      const context = new RequestContext({ type: "http" });
      context.set(REQUEST, request);
      return await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        const [values] = await em.execute(`select
          current_setting('app.user.id', true) as user_id,
          current_setting('app.workspace.id', true) as workspace_id,
          current_setting('app.member.id', true) as member_id,
          nullif(current_setting('app.user.permissions', true), '') as user_permissions,
          nullif(current_setting('app.workspace.permissions', true), '') as workspace_permissions`);
        return values;
      });
    };
    try {
      expect(await readContext(true)).toEqual({
        user_id: user.id,
        workspace_id: workspace.id,
        member_id: member.id,
        user_permissions: null,
        workspace_permissions: null,
      });
      expect(await readContext(false)).toEqual({
        user_id: "",
        workspace_id: workspace.id,
        member_id: "",
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

  it("keeps workspace member collections without introducing a user-to-member discovery dependency", () => {
    expect(orm.getMetadata(User).properties).not.toHaveProperty("members");
    expect(
      orm.getMetadata(Workspace).properties.members.targetMeta?.class,
    ).toBe(WorkspaceMember);
    expect(orm.getMetadata(Workspace).properties.members.mappedBy).toBe(
      "workspace",
    );
    expect(orm.getMetadata(Workspace).properties).not.toHaveProperty(
      "features",
    );
  });

  it("generates distinct policy names for composed policies", async () => {
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace' order by policyname",
      ),
    ).toEqual([
      { policyname: "workspace_delete_policy" },
      { policyname: "workspace_select_policy" },
      { policyname: "workspace_update_policy" },
    ]);
    expect(
      await orm.em.execute(
        "select policyname from pg_policies where tablename = 'workspace_invitation' order by policyname",
      ),
    ).toEqual([
      { policyname: "workspace_invitation_all_policy" },
      { policyname: "workspace_invitation_recipient_select_policy" },
    ]);
  });

  it("keeps child policies free of parent-workspace subqueries", async () => {
    const policies = await orm.em.execute<
      {
        qual: string;
        with_check: string | null;
      }[]
    >(
      "select qual, with_check from pg_policies where tablename in ('workspace_member', 'workspace_invitation')",
    );
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(policy.qual).toContain("current_setting");
      expect(policy.qual).not.toMatch(/from\s+workspace\b|deleted_at/i);
      if (policy.with_check) {
        expect(policy.with_check).toContain("app.workspace.id");
        expect(policy.with_check).not.toMatch(/exists|deleted_at/i);
      }
    }
  });

  it.each([
    "anonymous",
    "session",
    "user-key",
    "member-key",
    "non-member",
    "unconfigured-session",
  ] as const)(
    "applies native database identity directly from AuthMiddleware for %s",
    async (kind) => {
      const admin = orm.em.fork();
      const workspace = await admin.findOneOrFail(Workspace, "1");
      const user = admin.create(User, {
        name: kind,
        email: `${kind}@example.test`,
        emailVerified: true,
        permissions: [],
        roles: ["user"],
      });
      await admin.persist(user).flush();
      const isWorkspaceMember =
        kind === "session" ||
        kind === "user-key" ||
        kind === "unconfigured-session";
      let member: WorkspaceMember | undefined;
      if (isWorkspaceMember || kind === "member-key") {
        member = admin.create(WorkspaceMember, {
          type:
            kind === "member-key"
              ? WorkspaceMemberType.SERVICE_ACCOUNT
              : WorkspaceMemberType.USER,
          user: kind === "member-key" ? null : user,
          workspace,
          name: "WorkspaceMember profile",
        });
        await admin.persist(member).flush();
      }
      const hasUser = isWorkspaceMember || kind === "non-member";
      const em = orm.em.fork(
        kind === "unconfigured-session"
          ? {}
          : {
              session: {
                role: "anonymous",
                variables: { "app.workspace.id": "1" },
              },
            },
      );
      const options = {
        workspace: { enabled: true },
      } satisfies AuthModuleOptions;
      const middleware = new AuthMiddleware(
        withAuthTestFeatures(options),
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue(
              hasUser && kind !== "user-key"
                ? { user, session: new Session() }
                : null,
            ),
        } as unknown as SessionService,
        {
          validate: vi.fn().mockResolvedValue({
            apiKey:
              kind === "member-key"
                ? Object.assign(new WorkspaceApiKey(new ApiKey()), { member })
                : Object.assign(new UserApiKey(new ApiKey()), { user }),
            ownerType: kind === "user-key" ? "user" : "workspace_member",
            user: kind === "member-key" ? null : user,
            member: kind === "member-key" ? member : null,
            workspace,
          }),
        } as unknown as ApiKeyAuthenticationService,
        em,
        createTestAuthContext(em, withAuthTestFeatures(options)),
      );
      const request = {
        headers: {
          ...(kind === "member-key" ? {} : { "x-workspace-id": "1" }),
          ...(kind.endsWith("key") ? { authorization: "Bearer sk-key" } : {}),
        },
      } as Request;
      const context = new RequestContext({ type: "http" });
      context.set(REQUEST, request);
      await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(
          await em.execute(
            "select current_user as role, current_setting('app.user.id', true) as app_user, current_setting('app.workspace.id', true) as app_workspace, current_setting('app.member.id', true) as app_member",
          ),
        ).toEqual([
          {
            role: kind === "anonymous" ? "anonymous" : "authenticated",
            app_user: hasUser ? user.id : "",
            app_workspace: kind === "non-member" ? "" : "1",
            app_member: member?.id ?? "",
          },
        ]);
        if (kind === "anonymous") {
          expect(
            await em.nativeUpdate(Workspace, "1", { name: "Denied" }),
          ).toBe(0);
        } else {
          expect(await em.nativeUpdate(Workspace, "1", { name: kind })).toBe(
            kind === "non-member" ? 0 : 1,
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

  it.each([
    ["workspace-member:read", WorkspaceMemberType.USER],
    ["workspace-service-account:read", WorkspaceMemberType.SERVICE_ACCOUNT],
  ] as const)(
    "filters member pages and counts by %s under RLS",
    async (permission, type) => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, {
        name: "WorkspaceMember type permissions",
      });
      const user = admin.create(User, {
        name: "Reader",
        email: `${randomUUID()}@example.test`,
        emailVerified: true,
      });
      const actor = admin.create(WorkspaceMember, {
        workspace,
        user,
        name: "Reader",
        roles: [],
        permissions: [permission],
      });
      const serviceAccount = admin.create(WorkspaceMember, {
        workspace,
        user: null,
        name: "Service",
        type: WorkspaceMemberType.SERVICE_ACCOUNT,
        roles: [],
        permissions: [],
      });
      await admin.persist([actor, serviceAccount]).flush();
      const em = orm.em.fork({
        session: {
          role: "authenticated",
          variables: {
            "app.workspace.id": workspace.id,
            "app.user.id": user.id,
            "app.system_account.id": "",
            "app.member.id": actor.id,
          },
        },
      });
      const service = new WorkspaceMemberService(
        em,
        {
          workspace: { enabled: true },
        },
        createTestAuthContext(em, {
          workspace: { enabled: true },
        }),
      );
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          stageIdentity({ user, workspace, member: actor });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures({ workspace: { enabled: true } }),
          ).getAbility();
          const page = await service.getWorkspaceMemberConnectionByWorkspace(
            workspace,
            {
              first: 10,
            },
          );
          expect(page.edges.map(({ node }) => node.id)).toEqual([
            type === WorkspaceMemberType.USER ? actor.id : serviceAccount.id,
          ]);
          expect(page.totalCount).toBe(1);
          const forbidden =
            type === WorkspaceMemberType.USER ? serviceAccount : actor;
          expect(await service.getWorkspaceMember(forbidden.id)).toBeNull();
          const filtered =
            await service.getWorkspaceMemberConnectionByWorkspace(workspace, {
              first: 10,
              filter: { type: { $eq: forbidden.type } },
            });
          expect(filtered.edges).toEqual([]);
          expect(filtered.totalCount).toBe(0);
        },
      );
      await admin.nativeDelete(Workspace, workspace.id);
      await admin.nativeDelete(User, user.id);
    },
  );

  it.each([
    { permissions: [], role: "member" },
    { permissions: ["workspace:update"], role: null },
    { permissions: [], role: "automation" },
  ])(
    "creates a service account before issuing its key with role $role and grants $permissions",
    async ({ permissions, role }) => {
      const admin = orm.em.fork();
      const user = admin.create(User, {
        name: "Key issuer",
        email: `${randomUUID()}@example.test`,
        emailVerified: true,
      });
      const workspace = admin.create(Workspace, {
        name: "Automatic service account",
      });
      const actor = admin.create(WorkspaceMember, {
        user,
        workspace,
        name: "Owner",
        roles: ["owner"],
      });
      await admin.persist(actor).flush();
      const options: AuthModuleOptions =
        role === "automation"
          ? {
              workspace: {
                enabled: true,
                defaultRole: "automation",
                roles: { automation: ["workspace:read"] },
              },
            }
          : { workspace: { enabled: true } };
      const em = orm.em.fork({
        session: {
          role: "authenticated",
          variables: {
            "app.user.id": user.id,
            "app.workspace.id": workspace.id,
            "app.system_account.id": "",
            "app.member.id": actor.id,
          },
        },
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(EntityManager, em);
          stageIdentity({ user, workspace, member: actor });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          const members = new WorkspaceMemberService(
            em,
            options,
            createTestAuthContext(em, options),
          );
          const serviceAccount = await members.addWorkspaceServiceAccount(
            workspace,
            "Deploy",
            {
              permissions,
              ...(permissions.length ? { roles: [] } : {}),
            },
          );
          const service = new WorkspaceApiKeyService(
            em,
            withAuthTestFeatures(options),
            createTestApiKeyService(em, withAuthTestFeatures(options)),
            new WorkspaceMemberService(
              em,
              withAuthTestFeatures(options),
              createTestAuthContext(em, withAuthTestFeatures(options)),
            ),
          );
          const created = await service.createWorkspaceApiKey(workspace, {
            name: "Deploy",
            member: serviceAccount,
            permissions,
          });
          const owner = await admin.findOneOrFail(
            WorkspaceMember,
            created.entity.owner.id,
          );
          expect(owner.type).toBe(WorkspaceMemberType.SERVICE_ACCOUNT);
          expect(owner.name).toBe("Deploy");
          expect(owner.user).toBeNull();
          expect(owner.roles).toEqual(role ? [role] : []);
          expect(owner.permissions).toEqual(permissions);
          expect(
            (await admin.findOneOrFail(ApiKey, created.entity.id)).permissions,
          ).toEqual(permissions);
          stageIdentity({
            user: null,
            member: owner,
            workspace,
            apiKey: created.entity,
          });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          expect(can("read", Workspace)).toBe(permissions.length === 0);
          expect(can("update", Workspace)).toBe(permissions.length > 0);
          stageIdentity({
            user,
            member: actor,
            workspace,
            apiKey: null,
          });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          const retainedAccount = await members.addWorkspaceServiceAccount(
            workspace,
            "Retained account",
            {
              permissions,
              ...(permissions.length ? { roles: [] } : {}),
            },
          );
          const transaction = em.transactional.bind(em);
          vi.spyOn(em, "transactional").mockImplementation(
            async (callback, transactionOptions) =>
              await transaction(async (manager) => {
                await callback(manager);
                throw new Error("Commit failure");
              }, transactionOptions),
          );
          stageIdentity({
            user,
            member: actor,
            workspace,
            apiKey: null,
          });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          await expect(
            service.createWorkspaceApiKey(workspace, {
              name: "Rolled back",
              member: retainedAccount,
              permissions,
            }),
          ).rejects.toThrow("Commit failure");
          expect(
            await admin.count(WorkspaceMember, {
              workspace,
              name: "Retained account",
            }),
          ).toBe(1);
          expect(
            await admin.count(ApiKey, {
              name: "Rolled back",
              ownerType: "workspace_member",
              owner: retainedAccount,
            }),
          ).toBe(0);
          vi.restoreAllMocks();
        },
      );
      await admin.nativeDelete(Workspace, workspace.id);
      await admin.nativeDelete(User, user.id);
    },
  );

  it("excludes inherited keys from restricted credential pagination and mutation under RLS", async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: "Key issuer",
      email: `${randomUUID()}@example.test`,
      emailVerified: true,
    });
    const workspace = admin.create(Workspace, {
      name: "Inherited key boundary",
    });
    const actor = admin.create(WorkspaceMember, {
      user,
      workspace,
      name: "Owner",
      roles: ["owner"],
    });
    const inherited = admin.create(ApiKey, {
      owner: actor,
      name: "Full owner grants",
      key: randomUUID(),
      permissions: [],
    });
    const limited = admin.create(ApiKey, {
      owner: actor,
      name: "Limited",
      key: randomUUID(),
      permissions: ["workspace-api-key:read", "workspace-api-key:write"],
    });
    await admin.persist([inherited, limited]).flush();
    const em = orm.em.fork({
      session: {
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
          "app.system_account.id": "",
          "app.member.id": actor.id,
        },
      },
    });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(EntityManager, em);
      stageIdentity({
        user,
        member: actor,
        workspace,
        apiKey: limited,
      });
      createTestAuthContext(
        undefined,
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ).getAbility();
      const service = new WorkspaceApiKeyService(
        em,
        withAuthTestFeatures({
          workspace: { enabled: true },
        }),
        createTestApiKeyService(
          em,
          withAuthTestFeatures({
            workspace: { enabled: true },
          }),
        ),
        new WorkspaceMemberService(
          em,
          withAuthTestFeatures({
            workspace: { enabled: true },
          }),
          createTestAuthContext(
            em,
            withAuthTestFeatures({
              workspace: { enabled: true },
            }),
          ),
        ),
      );
      const page = await service.getWorkspaceApiKeyConnection(workspace, {
        first: 10,
      });
      expect(page.edges.map(({ node }) => node.id)).toEqual([limited.id]);
      expect(page.totalCount).toBe(1);
      expect(
        await service.getWorkspaceApiKey(inherited.id, workspace),
      ).toBeNull();
      await expect(
        service.updateWorkspaceApiKey(inherited.id, {
          permissions: ["workspace-api-key:read"],
        }),
      ).rejects.toThrow("Unrestricted API keys");
      await expect(service.deleteWorkspaceApiKey(inherited.id)).rejects.toThrow(
        "Unrestricted API keys",
      );
      stageIdentity({ apiKey: inherited });
      createTestAuthContext(
        undefined,
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ).getAbility();
      const fullPage = await service.getWorkspaceApiKeyConnection(workspace, {
        first: 10,
      });
      expect(fullPage.totalCount).toBe(2);
    });
    await admin.nativeDelete(Workspace, workspace.id);
    await admin.nativeDelete(User, user.id);
  });

  it("persists member permissions across isolated auth forks without flushing unrelated changes", async () => {
    const admin = orm.em.fork();
    const workspace = await admin.findOneOrFail(Workspace, "1");
    const originalName = workspace.name;
    const user = admin.create(User, {
      name: "Permission target",
      email: "permission-target@example.test",
      emailVerified: true,
    });
    const member = admin.create(WorkspaceMember, {
      workspace,
      user,
      name: "WorkspaceMember profile",
    });
    await admin.persist(member).flush();
    const session = {
      role: "authenticated",
      variables: { "app.workspace.id": workspace.id, "app.user.id": "" },
    };
    const scoped = orm.em.fork({ session });
    const service = new WorkspaceMemberService(
      scoped,
      {
        workspace: { enabled: true },
      },
      createTestAuthContext(scoped, {
        workspace: { enabled: true },
      }),
    );
    const context = new RequestContext({ type: "test" });
    context.set(EntityManager, scoped);
    context.set(BaseWorkspace, workspace);
    context.set(User, user);
    context.set(
      BaseWorkspaceMember,
      Object.assign(new WorkspaceMember(), {
        workspace,
        user,
        roles: ["owner"],
      }),
    );

    await RequestContext.run(context, async () => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures({ workspace: { enabled: true } }),
      ).getAbility();
      const pendingWorkspace = await scoped.findOneOrFail(
        Workspace,
        workspace.id,
      );
      pendingWorkspace.name = "Unrelated pending change";
      for (const permissions of [
        ["workspace:update"],
        ["workspace-member:write"],
        [],
      ]) {
        const detached = await service.getWorkspaceMember(member.id);
        assert(detached);
        const updated = await service.setWorkspaceMemberPermissions(
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

  describe("API-key owner policy boundaries", () => {
    const userId = "900001";
    const foreignId = "900002";
    const probeRole = "api_key_rls_probe";
    const anonymousProbeRole = "api_key_anonymous_rls_probe";
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
        `insert into api_key (id, owner_type, owner_id, name, key) values (?, ?, ?, ?, ?)`,
        [id, ownerType, ownerId, "Policy probe", randomUUID()],
      );

    beforeAll(async () => {
      const admin = orm.em.fork();
      const user = admin.create(User, {
        id: userId,
        name: "API-key owner",
        email: "api-key-owner@example.test",
        emailVerified: true,
        permissions: [],
        roles: ["user"],
      });
      const foreignUser = admin.create(User, {
        id: foreignId,
        name: "Other API-key owner",
        email: "other-api-key-owner@example.test",
        emailVerified: true,
        permissions: [],
        roles: ["user"],
      });
      // The IDs intentionally collide across the two owner types.
      const workspace = admin.create(Workspace, {
        id: userId,
        name: "Key owner",
      });
      const foreignWorkspace = admin.create(Workspace, {
        id: foreignId,
        name: "Other key owner",
      });
      keys = [user, workspace, foreignUser, foreignWorkspace].map((owner) =>
        owner instanceof User
          ? admin.create(ApiKey, {
              owner: owner,
              name: "Owner boundary fixture",
              key: randomUUID(),
            })
          : admin.create(ApiKey, {
              owner: ref(
                WorkspaceMember,
                admin.create(WorkspaceMember, {
                  id: owner.id,
                  workspace: owner,
                  type: WorkspaceMemberType.SERVICE_ACCOUNT,
                  user: null,
                  name: "Service account",
                }),
              ),
              name: "Owner boundary fixture",
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
      await admin.nativeDelete(ApiKey, {
        id: keys.map((key) => key.id),
      });
      await admin.nativeDelete(User, { id: [userId, foreignId] });
      await admin.nativeDelete(Workspace, { id: [userId, foreignId] });
    });

    it.each(["user", "workspace_member"])(
      "combines %s-key RLS with required ownership columns and no owner foreign key",
      async (ownerType) => {
        const table = "api_key";
        const em = orm.em.fork();
        expect(
          await em.execute(
            "select relrowsecurity from pg_class where oid = ?::regclass",
            [table],
          ),
        ).toEqual([{ relrowsecurity: true }]);
        for (const role of ["anonymous", "authenticated"]) {
          for (const privilege of ["select", "insert", "update", "delete"]) {
            expect(
              await em.execute(
                "select has_table_privilege(?, ?, ?) as allowed",
                [role, table, privilege],
              ),
            ).toEqual([{ allowed: true }]);
          }
        }
        await expect(
          em.execute(`insert into ${table} (name, key) values (?, ?)`, [
            "No owner",
            randomUUID(),
          ]),
        ).rejects.toThrow(/not-null constraint/i);
        const retainedId = ownerType === "user" ? "900199" : "900200";
        await insertKey(em, retainedId, ownerType, "999999999");
        expect(await em.count(ApiKey, retainedId)).toBe(1);
        await em.nativeDelete(ApiKey, retainedId);
        const otherType = ownerType === "user" ? "workspace_member" : "user";
        expect(
          await em.execute(
            "select column_name from information_schema.columns where table_name = ? and column_name = ?",
            [table, otherType + "_id"],
          ),
        ).toEqual([]);
      },
    );

    it("retains member-key audit records after workspace deletion", async () => {
      const em = orm.em.fork();
      const workspace = em.create(Workspace, { name: "Cascade workspace" });
      const key = em.create(ApiKey, {
        owner: ref(
          WorkspaceMember,
          em.create(WorkspaceMember, {
            workspace,
            name: "Cascade member",
            type: WorkspaceMemberType.SERVICE_ACCOUNT,
            user: null,
          }),
        ),
        name: "Cascade key",
        key: randomUUID(),
      });
      await em.persist(key).flush();
      expect(await em.count(ApiKey, key.id)).toBe(1);
      await em.nativeDelete(Workspace, workspace.id, { filters: false });
      expect(await em.count(ApiKey, key.id)).toBe(1);
    });

    it.each([
      { name: "user only", user: userId, workspace: "", visible: [0] },
      { name: "workspace only", user: "", workspace: userId, visible: [1] },
      {
        name: "distinct user and workspace",
        user: foreignId,
        workspace: userId,
        visible: [1, 2],
      },
      { name: "empty identity", user: "", workspace: "", visible: [] },
    ])(
      "restricts all operations by owner type and ID: $name",
      async (identity) => {
        const em = scoped({
          "app.user.id": identity.user,
          "app.workspace.id": identity.workspace,
        });
        const visibleIds = identity.visible
          .map((index) => keys[index].id)
          .sort();
        expect(
          [...(await em.find(ApiKey, {}))].map((key) => key.id).sort(),
        ).toEqual(visibleIds);
        for (const key of keys) {
          expect(
            await em.nativeUpdate<ApiKey>(ApiKey, key.id, {
              name: identity.name,
            }),
          ).toBe(visibleIds.includes(key.id) ? 1 : 0);
          if (!visibleIds.includes(key.id)) {
            expect(await em.nativeDelete<ApiKey>(ApiKey, key.id)).toBe(0);
          }
        }
      },
    );

    it("denies missing identity and anonymous access even with table privileges", async () => {
      expect(await scoped().find(ApiKey, {})).toEqual([]);
      expect(await scoped().find(ApiKey, {})).toEqual([]);
      const anonymous = scoped(
        { "app.user.id": userId, "app.workspace.id": userId },
        anonymousProbeRole,
      );
      expect(await anonymous.find(ApiKey, {})).toEqual([]);
      expect(await anonymous.find(ApiKey, {})).toEqual([]);
      expect(
        await anonymous.nativeUpdate(ApiKey, keys[0].id, {
          name: "Denied",
        }),
      ).toBe(0);
      expect(await anonymous.nativeDelete(ApiKey, keys[0].id)).toBe(0);
      await expect(
        insertKey(anonymous, "900100", "user", userId),
      ).rejects.toThrow(/row.level security/i);
    });

    it.each(["user", "workspace_member"] as const)(
      "checks the required owner on insert and update for %s keys",
      async (ownerType) => {
        const em = scoped({
          "app.user.id": ownerType === "user" ? userId : "",
          "app.workspace.id": ownerType === "workspace_member" ? userId : "",
        });
        const otherType = ownerType === "user" ? "workspace_member" : "user";
        const id = ownerType === "user" ? "900101" : "900102";
        try {
          await expect(insertKey(em, id, otherType, userId)).rejects.toThrow(
            /row.level security/i,
          );
          await expect(insertKey(em, id, ownerType, foreignId)).rejects.toThrow(
            /row.level security/i,
          );
          await insertKey(em, id, ownerType, userId);
          await expect(
            em.execute(`update api_key set owner_id = ? where id = ?`, [
              foreignId,
              id,
            ]),
          ).rejects.toThrow(/row.level security/i);
          const stored = await em.findOneOrFail<ApiKey>(ApiKey, id);
          expect(
            (stored.ownerType === "user" ? stored.user : stored.member)?.id,
          ).toBe(userId);
          expect(
            (stored.ownerType === "user"
              ? stored.user
              : stored.member
            )?.unwrap(),
          ).toBeInstanceOf(ownerType === "user" ? User : WorkspaceMember);
          expect(await em.nativeDelete<ApiKey>(ApiKey, id)).toBe(1);
        } finally {
          await orm.em.fork().nativeDelete<ApiKey>(ApiKey, id);
        }
      },
    );
  });

  describe("workspace policy boundaries", () => {
    let user: User;
    let current: Workspace;
    let foreign: Workspace;
    let unrelated: Workspace;
    let ownWorkspaceMember: WorkspaceMember;
    let foreignWorkspaceMember: WorkspaceMember;
    let foreignWorkspaceInvitation: WorkspaceInvitation;

    const scoped = (workspaceId: string, userId = user.id) =>
      orm.em.fork({
        session: {
          role: "authenticated",
          variables: { "app.user.id": userId, "app.workspace.id": workspaceId },
        },
      });
    const options = { workspace: { enabled: true } };
    const workspaceServiceFor = (em: EntityManager) =>
      new WorkspaceService(em, options, createTestAuthContext(em, options));
    const invitationServiceFor = (em: EntityManager) =>
      new WorkspaceInvitationService(em, options);

    beforeAll(async () => {
      const admin = orm.em.fork();
      user = admin.create(User, {
        name: "Policy user",
        email: "policy-user@example.test",
        emailVerified: true,
        permissions: [],
        roles: ["user"],
      });
      current = admin.create(Workspace, { name: "Current" });
      foreign = admin.create(Workspace, { name: "Foreign" });
      unrelated = admin.create(Workspace, { name: "Unrelated" });
      ownWorkspaceMember = admin.create(WorkspaceMember, {
        user,
        workspace: current,
        name: "WorkspaceMember profile",
      });
      foreignWorkspaceMember = admin.create(WorkspaceMember, {
        user,
        workspace: foreign,
        status: WorkspaceMemberStatus.DISABLED,
        name: "WorkspaceMember profile",
      });
      foreignWorkspaceInvitation = admin.create(WorkspaceInvitation, {
        email: user.email,
        inviter: user,
        workspace: foreign,
        expiresAt: new Date(Date.now() + 60000),
      });
      await admin
        .persist([
          user,
          current,
          foreign,
          unrelated,
          ownWorkspaceMember,
          foreignWorkspaceMember,
          foreignWorkspaceInvitation,
        ])
        .flush();
    });

    it.each(["selected", "unselected"] as const)(
      "allows reading but not changing own foreign memberships with a %s workspace",
      async (selection) => {
        const em = scoped(selection === "selected" ? current.id : "");
        expect(
          await em.findOne(WorkspaceMember, foreignWorkspaceMember.id),
        ).not.toBeNull();
        expect(
          await em.nativeUpdate(WorkspaceMember, foreignWorkspaceMember.id, {
            status: WorkspaceMemberStatus.ACTIVE,
          }),
        ).toBe(0);
        expect(
          await em.nativeDelete(WorkspaceMember, foreignWorkspaceMember.id),
        ).toBe(0);
      },
    );

    it.each(["user", "member-key"] as const)(
      "rejects cross-workspace member inserts and moves for a %s identity",
      async (identity) => {
        const em = scoped(current.id, identity === "user" ? user.id : "");
        await expect(
          em.insert(WorkspaceMember, {
            user: user.id,
            workspace: unrelated.id,
            name: "WorkspaceMember profile",
          }),
        ).rejects.toThrow(/row.level security/i);
        await expect(
          em.nativeUpdate(WorkspaceMember, ownWorkspaceMember.id, {
            workspace: unrelated.id,
          }),
        ).rejects.toThrow(/row.level security/i);
        expect(
          await em.nativeUpdate(WorkspaceMember, ownWorkspaceMember.id, {
            status: WorkspaceMemberStatus.ACTIVE,
          }),
        ).toBe(1);
      },
    );

    it.each(["user", "member-key"] as const)(
      "isolates invitation reads and writes for a %s identity",
      async (identity) => {
        const em = scoped(current.id, identity === "user" ? user.id : "");
        expect(
          (await em.find(WorkspaceInvitation, {})).map(({ id }) => id),
        ).toEqual(identity === "user" ? [foreignWorkspaceInvitation.id] : []);
        expect(
          await em.nativeUpdate(
            WorkspaceInvitation,
            foreignWorkspaceInvitation.id,
            {
              email: "must-not-change@example.test",
            },
          ),
        ).toBe(0);
        expect(
          await em.nativeDelete(
            WorkspaceInvitation,
            foreignWorkspaceInvitation.id,
          ),
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

    it("permits recipient reads without workspace membership while denying unrelated identities and writes", async () => {
      const em = scoped("");
      expect(
        (await em.find(WorkspaceInvitation, {})).map(({ id }) => id),
      ).toEqual([foreignWorkspaceInvitation.id]);
      expect(
        await em.nativeDelete(
          WorkspaceInvitation,
          foreignWorkspaceInvitation.id,
        ),
      ).toBe(0);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          stageIdentity({ user });
          const service = invitationServiceFor(em);
          expect(
            (
              await service.getWorkspaceInvitation(
                foreignWorkspaceInvitation.id,
              )
            )?.id,
          ).toBe(foreignWorkspaceInvitation.id);
          expect(
            await invitationServiceFor(scoped("", "")).getWorkspaceInvitation(
              foreignWorkspaceInvitation.id,
            ),
          ).toBeNull();
          expect(
            await invitationServiceFor(
              scoped("", "999999999"),
            ).getWorkspaceInvitation(foreignWorkspaceInvitation.id),
          ).toBeNull();
          expect(
            (
              await service.getWorkspaceInvitationConnectionByUser(user, {
                first: 20,
              })
            ).edges.map(({ node }) => node.id),
          ).toContain(foreignWorkspaceInvitation.id);
          // Even an authorized service caller cannot override the database identity.
          const hidden = await invitationServiceFor(
            scoped("", "999999999"),
          ).getWorkspaceInvitationConnectionByUser(user, { first: 20 });
          expect(hidden.edges).toEqual([]);
          expect(hidden.totalCount).toBe(0);
          expect(em.getSessionContext()?.variables?.["app.workspace.id"]).toBe(
            "",
          );
        },
      );
    });

    it("creates a workspace and owner in an isolated transaction before selecting a workspace", async () => {
      const em = scoped("");
      const pendingUser = await em.findOneOrFail(User, user.id);
      pendingUser.name = "Unrelated pending change";
      const context = new RequestContext({ type: "test" });
      context.set(EntityManager, em);
      const workspace = await RequestContext.run(context, async () => {
        stageIdentity({ user: pendingUser });
        createTestAuthContext(
          undefined,
          withAuthTestFeatures(options),
        ).getAbility();
        const result = await workspaceServiceFor(em).createWorkspace(
          pendingUser,
          {
            name: "Created via service",
          },
        );
        expect(RequestContext.get(EntityManager)).toBe(em);
        return result;
      });
      const admin = orm.em.fork();
      const owner = await admin.findOneOrFail(WorkspaceMember, {
        user: user.id,
        workspace: workspace.id,
      });
      expect(owner.roles).toEqual(["owner"]);
      expect(owner.status).toBe(WorkspaceMemberStatus.ACTIVE);
      expect((await admin.findOneOrFail(User, user.id)).name).toBe(
        "Policy user",
      );
      expect(em.getSessionContext()?.variables?.["app.workspace.id"]).toBe("");
    });

    it("rolls back workspace creation when owner membership persistence fails", async () => {
      const em = scoped("");
      const name = "Must roll back";
      const missingUser = Object.assign(new User(), {
        id: "9223372036854775807",
        name: "Missing",
        email: "missing@example.test",
      });
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          stageIdentity({ user: missingUser });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          await expect(
            workspaceServiceFor(em).createWorkspace(missingUser, { name }),
          ).rejects.toThrow(/foreign key/i);
        },
      );
      expect(await orm.em.fork().count(Workspace, { name })).toBe(0);
    });

    it("requires the authorized service to create workspaces", async () => {
      const em = scoped("");
      await expect(
        em.insert(Workspace, { name: "Direct insert is denied" }),
      ).rejects.toThrow(/row.level security/i);
      // Check SQL without RETURNING too: no request-role INSERT policy exists.
      await expect(
        em.execute("insert into workspace (name) values (?)", [
          "Direct insert without returning is denied",
        ]),
      ).rejects.toThrow(/row.level security/i);
    });

    const accessMatrix = (
      ["anonymous", "self", "other-member", "member-key"] as const
    ).flatMap((identity) =>
      (["current", "foreign", "deleted"] as const).flatMap((scope) =>
        (["workspace_member", "workspace_invitation"] as const).map(
          (table) => ({
            identity,
            scope,
            table,
          }),
        ),
      ),
    );

    it.each(accessMatrix)(
      "$identity accessing $table in a $scope workspace respects read/write boundaries",
      async ({ identity, scope, table }) => {
        const admin = orm.em.fork();
        const targetWorkspace = admin.create(Workspace, {
          name: "Matrix target",
        });
        const otherUser = admin.create(User, {
          name: "Other member",
          email: `${randomUUID()}@example.test`,
          emailVerified: true,
          permissions: [],
          roles: ["user"],
        });
        const targetWorkspaceMember = admin.create(WorkspaceMember, {
          workspace: targetWorkspace,
          user: identity === "other-member" ? otherUser : user,
          name: "WorkspaceMember profile",
        });
        const targetWorkspaceInvitation = admin.create(WorkspaceInvitation, {
          workspace: targetWorkspace,
          inviter: user,
          email: `${randomUUID()}@example.test`,
          expiresAt: new Date(Date.now() + 60000),
        });
        await admin
          .persist([
            targetWorkspace,
            otherUser,
            targetWorkspaceMember,
            targetWorkspaceInvitation,
          ])
          .flush();

        const em = scoped(
          scope === "foreign" ? current.id : targetWorkspace.id,
          identity === "anonymous" || identity === "member-key" ? "" : user.id,
        );
        if (identity === "anonymous") {
          em.setSessionContext({ role: "anonymous" });
        }
        if (scope === "deleted") {
          // Simulate deletion after authentication; foreign keys remove all children.
          await admin.nativeDelete(Workspace, targetWorkspace.id);
        }
        const targetId =
          table === "workspace_member"
            ? targetWorkspaceMember.id
            : targetWorkspaceInvitation.id;
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
          table === "workspace_member"
            ? em.execute(
                "insert into workspace_member (workspace_id, user_id, name) values (?, ?, ?)",
                [
                  targetWorkspace.id,
                  identity === "other-member" ? user.id : otherUser.id,
                  "New member",
                ],
              )
            : em.execute(
                "insert into workspace_invitation (id, workspace_id, inviter_id, email, expires_at) values (?, ?, ?, ?, now())",
                [
                  randomUUID(),
                  targetWorkspace.id,
                  user.id,
                  `${randomUUID()}@example.test`,
                ],
              );

        if (identity === "anonymous") {
          expect(await read()).toEqual([]);
          expect(await update()).toEqual([]);
          expect(await remove()).toEqual([]);
          await expect(insert()).rejects.toThrow(/row.level security/i);
          return;
        }

        if (scope === "deleted") {
          expect(await read()).toEqual([]);
          expect(await update()).toEqual([]);
          expect(await remove()).toEqual([]);
          await expect(insert()).rejects.toThrow(/foreign key/i);
          return;
        }
        const canWrite = scope !== "foreign";
        const canRead =
          canWrite ||
          (scope === "foreign" &&
            identity === "self" &&
            table === "workspace_member");
        expect(await read()).toHaveLength(canRead ? 1 : 0);
        expect(await update()).toHaveLength(canWrite ? 1 : 0);
        if (canWrite) {
          await insert();
        } else {
          await expect(insert()).rejects.toThrow(/row.level security/i);
        }
        expect(await remove()).toHaveLength(canWrite ? 1 : 0);
      },
    );

    it("does not activate a deleted workspace on a new authenticated request", async () => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, {
        name: "Deleted before authentication",
      });
      const member = admin.create(WorkspaceMember, {
        workspace,
        user,
        name: "WorkspaceMember profile",
      });
      await admin.persist([workspace, member]).flush();
      await admin.nativeDelete(Workspace, workspace.id);
      const em = scoped(workspace.id);
      em.setSessionContext({ role: "anonymous" });
      const middleware = new AuthMiddleware(
        withAuthTestFeatures({}),
        {
          getCurrentAuthenticatedSession: vi
            .fn()
            .mockResolvedValue({ user, session: new Session() }),
        } as unknown as SessionService,
        { validate: vi.fn() } as unknown as ApiKeyAuthenticationService,
        em,
        createTestAuthContext(em, withAuthTestFeatures({})),
      );
      const request = {
        headers: { "x-workspace-id": workspace.id },
      } as unknown as Request;
      const context = new RequestContext({ type: "http" });
      context.set(REQUEST, request);
      await RequestContext.run(context, async () => {
        const next = vi.fn();
        await middleware.use(request, {} as never, next);
        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(RequestContext.get(Workspace)).toBeNull();
        expect(em.getSessionContext()?.variables?.["app.workspace.id"]).toBe(
          "",
        );
        await expect(
          em.insert(WorkspaceMember, {
            workspace: workspace.id,
            name: "WorkspaceMember profile",
          }),
        ).rejects.toThrow(/row.level security/i);
      });
    });

    it("permanently deletes through the authorized service with scoped RLS and foreign-key cascades", async () => {
      const admin = orm.em.fork();
      const workspace = admin.create(Workspace, { name: "Permanent deletion" });
      const owner = admin.create(WorkspaceMember, {
        workspace,
        user,
        roles: ["owner"],
        name: "WorkspaceMember profile",
      });
      const invitation = admin.create(WorkspaceInvitation, {
        workspace,
        inviter: user,
        email: "permanent-delete@example.test",
        expiresAt: new Date(Date.now() + 60000),
      });
      await admin.persist([workspace, owner, invitation]).flush();
      const em = scoped(workspace.id);
      const result = await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          stageIdentity({ user, workspace, member: owner });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          return await workspaceServiceFor(em).deleteWorkspace(workspace);
        },
      );
      expect(result.id).toBe(workspace.id);
      expect(await admin.count(Workspace, workspace.id)).toBe(0);
      expect(await admin.count(WorkspaceMember, owner.id)).toBe(0);
      expect(await admin.count(User, user.id)).toBe(1);
      expect(
        await scoped(workspace.id).findOne(Workspace, workspace.id),
      ).toBeNull();
      expect(
        await em.nativeUpdate(Workspace, workspace.id, { name: "Denied" }),
      ).toBe(0);
      expect(await admin.count(WorkspaceInvitation, invitation.id)).toBe(0);
    });
  });

  it("allows authenticated User reads independently of permission names but denies anonymous reads", async () => {
    const admin = orm.em.fork();
    const viewer = admin.create(User, {
      name: "Viewer private",
      email: "rls-viewer@example.test",
      emailVerified: true,
    });
    const target = admin.create(User, {
      name: "Target private",
      email: "rls-target@example.test",
      emailVerified: true,
    });
    const workspace = admin.create(Workspace, {
      name: "Private profile boundary",
    });
    const owner = admin.create(WorkspaceMember, {
      name: "Visible owner",
      email: "owner-contact@example.test",
      user: viewer,
      workspace,
      roles: ["owner"],
    });
    const member = admin.create(WorkspaceMember, {
      name: "Visible member",
      email: "member-contact@example.test",
      user: target,
      workspace,
    });
    await admin.persist([viewer, target, workspace, owner, member]).flush();
    const scoped = (id: string) =>
      orm.em.fork({
        session: {
          role: "authenticated",
          variables: {
            "app.user.id": id,
            "app.workspace.id": workspace.id,
          },
        },
      });
    for (const id of [viewer.id, ""]) {
      const em = scoped(id);
      expect(await em.findOne(User, target.id)).not.toBeNull();
      expect(await em.findOne(User, { email: target.email })).not.toBeNull();
      expect(await em.findOne(WorkspaceMember, member.id)).toMatchObject({
        name: "Visible member",
        email: "member-contact@example.test",
      });
    }
    expect(await scoped(viewer.id).findOne(User, viewer.id)).not.toBeNull();
    for (const permission of ["user:read", "account-admin:view"]) {
      await admin.nativeUpdate(User, viewer.id, { permissions: [permission] });
      expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    }
    await admin.nativeUpdate(User, viewer.id, {
      permissions: [],
      roles: ["admin"],
    });
    // User profile authorization belongs to Services, not the SELECT policy.
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    await admin.nativeUpdate(User, viewer.id, { roles: ["user"] });
    expect(await scoped(viewer.id).findOne(User, target.id)).not.toBeNull();
    const anonymous = orm.em.fork({ session: { role: "anonymous" } });
    expect(await anonymous.findOne(User, target.id)).toBeNull();

    const options: AuthModuleOptions = {
      workspace: { enabled: true },
      buildAbility: (rules) => {
        rules.cannot(["read"], User, { id: { $ne: target.id } });
      },

      user: {
        permissions: ["account-admin:view"],
        roles: { user: [] },
      },
    };
    const service = new UserService(
      scoped(viewer.id),
      withAuthTestFeatures(options),
      {} as never,
      {} as never,
      createTestAuthContext(scoped(viewer.id), withAuthTestFeatures(options)),
    );
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      viewer.roles = ["user"];
      viewer.permissions = ["account-admin:view", "user:read"];
      RequestContext.set(User, viewer);
      createTestAuthContext(undefined, withAuthTestFeatures(options)).refresh();
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
      await expect(service.getUser(viewer.id)).rejects.toThrow("not allowed");
      await expect(service.getUserByEmail(viewer.email)).rejects.toThrow(
        "not allowed",
      );
      viewer.permissions = [];
      createTestAuthContext(undefined, withAuthTestFeatures(options)).refresh();
      await expect(service.getUser(target.id)).rejects.toThrow("not allowed");
      await expect(service.getUserConnection({ first: 10 })).rejects.toThrow(
        "not allowed",
      );
    });
  });

  it("authorizes User writes and cross-user Session reads through built-in grants in Services", async () => {
    const admin = orm.em.fork();
    const actor = admin.create(User, {
      name: "Custom administrator",
      emailVerified: true,
      email: `${randomUUID()}@example.test`,
      roles: ["user"],
      permissions: ["account-admin:manage"],
    });
    const target = admin.create(User, {
      name: "Target",
      emailVerified: true,
      email: `${randomUUID()}@example.test`,
    });
    const session = admin.create(Session, {
      user: target,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    });
    await admin.persist([actor, target, session]).flush();
    const options: AuthModuleOptions = {
      workspace: { enabled: true },
      user: {
        permissions: ["account-admin:manage"],
        roles: { user: [] },
      },
    };
    const em = orm.em.fork({
      session: {
        role: "authenticated",
        variables: { "app.user.id": actor.id },
      },
    });
    const users = new UserService(
      em,
      withAuthTestFeatures(options),
      {} as never,
      new UserDeletionService(em),
      createTestAuthContext(em, withAuthTestFeatures(options)),
    );
    const sessions = new SessionService({}, em, createTestAuthContext(em, {}));
    try {
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, actor);
          const authorize = () => {
            createTestAuthContext(
              undefined,
              withAuthTestFeatures(options),
            ).refresh();
          };
          actor.permissions = ["account-admin:manage"];
          authorize();
          await expect(
            users.updateUser(target.id, { name: "Denied" }),
          ).rejects.toThrow("not allowed");
          await expect(users.deleteUser(target.id)).rejects.toThrow(
            "not allowed",
          );
          await expect(
            sessions.getSessionConnectionByUser(target, { first: 10 }),
          ).rejects.toThrow("not allowed");
          actor.permissions = ["user:update", "user:delete", "session:read"];
          authorize();
          expect(
            await users.updateUser(target.id, { name: "Allowed" }),
          ).toMatchObject({ name: "Allowed" });
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
            "app.user.id": actor.id,
          });
        },
      );
    } finally {
      await admin.nativeDelete(User, { id: [actor.id, target.id] });
    }
  });

  it("requires user-backed members with independent workspace-visible profiles", async () => {
    const admin = orm.em.fork();
    const user = admin.create(User, {
      name: "Private user",
      email: "baseline-user@example.test",
      emailVerified: true,
    });
    const workspace = admin.create(Workspace, { name: "Baseline membership" });
    await admin.persist([user, workspace]).flush();
    const member = admin.create(WorkspaceMember, {
      user,
      workspace,
      name: "Shared member",
      email: "shared@example.test",
    });
    await admin.persist(member).flush();
    expect(await admin.findOneOrFail(WorkspaceMember, member.id)).toMatchObject(
      {
        name: "Shared member",
        email: "shared@example.test",
        user: { id: user.id },
      },
    );
    for (const [sql, params] of [
      [
        "insert into workspace_member (workspace_id, name) values (?, ?)",
        [workspace.id, "Missing user"],
      ],
      [
        "insert into workspace_member (workspace_id, user_id) values (?, ?)",
        [workspace.id, user.id],
      ],
    ] as const) {
      await expect(admin.execute(sql, [...params])).rejects.toThrow(
        /not-null constraint|check constraint/i,
      );
    }
    expect(
      await admin.execute(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'workspace_member' and column_name in ('type', 'searchable_name')",
      ),
    ).toEqual([{ column_name: "type" }]);
    expect(await orm.schema.getUpdateSchemaSQL({ wrap: false })).toBe("");
  });
});
