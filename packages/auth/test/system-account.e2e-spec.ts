import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { EventArgs } from "@mikro-orm/core";
import { EntityManager, MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
import type { Request } from "express";

import { SystemAccountService } from "../src/admin/services/system-account.service.js";
import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../src/api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../src/api-key/objects/system-api-key.object.js";
import { ApiKeyAuthenticationService } from "../src/api-key/services/api-key-authentication.service.js";
import { SystemApiKeyService } from "../src/api-key/services/system-api-key.service.js";
import { hashApiKey } from "../src/api-key/utils/api-key-credential.util.js";
import { getCurrentApiKey } from "../src/api-key/utils/get-current-api-key.util.js";
import { getAuthAbility } from "../src/common/utils/get-auth-ability.util.js";
import { resolveRequestPermissions } from "../src/common/utils/resolve-request-permissions.util.js";
import { AuthMiddleware } from "../src/core/auth.middleware.js";
import { Session } from "../src/core/entities/session.entity.js";
import { User } from "../src/core/entities/user.entity.js";
import type { AuthModuleOptions } from "../src/core/interfaces/auth-module-options.interface.js";
import type { SessionService } from "../src/core/services/session.service.js";
import { UserService } from "../src/core/services/user.service.js";
import { entities, workspaceEntities } from "../src/index.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";
import { WorkspaceService } from "../src/workspace/services/workspace.service.js";
import { createTestApiKeyService } from "./fixtures/auth-context.fixture.js";
import { createTestAuthContext } from "./fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

const options: AuthModuleOptions = {
  workspace: { enabled: true },
  apiKey: {
    system: {
      defaultPrefix: "machine_",
      allowedPermissions: [
        "user:read",
        "workspace:read-any",
        "workspace:update-any",
        "workspace:delete-any",
      ],
    },
  },
};

describe("independent system accounts with real persistence and authentication", () => {
  let orm: MikroORM;
  let administrator: User;
  let ordinary: User;
  let workspace: Workspace;
  let otherWorkspace: Workspace;

  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      dbName: "memory://",
      metadataProvider,
      metadataCache: { enabled: false },
      entities: [...entities, ...workspaceEntities],
    });
    await orm.em.execute("create role authenticated nologin noinherit");
    await orm.em.execute("create role anonymous nologin noinherit");
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
    const em = orm.em.fork();
    administrator = em.create(User, {
      name: "Administrator",
      email: "admin@example.test",
      emailVerified: true,
      roles: ["admin"],
    });
    ordinary = em.create(User, {
      name: "Ordinary",
      email: "ordinary@example.test",
      emailVerified: true,
    });
    workspace = em.create(Workspace, { name: "First tenant" });
    otherWorkspace = em.create(Workspace, { name: "Second tenant" });
    await em
      .persist([administrator, ordinary, workspace, otherWorkspace])
      .flush();
  });
  afterAll(async () => {
    await orm?.close();
  });

  const asAdministrator = async <T>(
    callback: (
      accounts: SystemAccountService,
      keys: SystemApiKeyService,
      em: EntityManager,
    ) => Promise<T>,
    user = administrator,
  ) =>
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const em = orm.em.fork({
        session: {
          role: "authenticated",
          variables: { "app.auth.user.id": user.id },
        },
      });
      RequestContext.set(EntityManager, em);
      RequestContext.set(User, user);
      RequestContext.set(Session, Object.assign(new Session(), { user }));
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(options),
      ).getAbility();
      return await callback(
        new SystemAccountService(em, withAuthTestFeatures(options)),
        new SystemApiKeyService(
          em,
          withAuthTestFeatures(options),
          createTestApiKeyService(em, withAuthTestFeatures(options)),
          new SystemAccountService(em, withAuthTestFeatures(options)),
        ),
        em,
      );
    });

  const issue = async (permissions = ["user:read", "workspace:read-any"]) =>
    await asAdministrator(async (accounts, keys) => {
      const account = await accounts.createSystemAccount({
        name: randomUUID(),
        permissions,
      });
      const key = await keys.createSystemApiKey({
        systemAccountId: account.id,
        name: "Integration",
        permissions,
      });
      expect(key.apiKey).toMatch(/^machine_/);
      return { account, ...key };
    });

  const withKey = async <T>(
    plaintext: string,
    callback: (em: EntityManager) => T | Promise<T>,
  ) =>
    await RequestContext.run(new RequestContext({ type: "http" }), async () => {
      const em = orm.em.fork();
      RequestContext.set(EntityManager, em);
      RequestContext.set(REQUEST, {
        headers: {
          authorization: `Bearer ${plaintext}`,
          "x-workspace-id": otherWorkspace.id,
        },
      } as unknown as Request);
      const middleware = new AuthMiddleware(
        withAuthTestFeatures(options),
        {
          getCurrentAuthenticatedSession: () => Promise.resolve(null),
        } as unknown as SessionService,
        new ApiKeyAuthenticationService(
          orm.em.fork(),
          withAuthTestFeatures(options),
        ),
        em,
        createTestAuthContext(em, withAuthTestFeatures(options)),
      );
      let error: unknown;
      const request = RequestContext.get<Request>(REQUEST);
      assert(request);
      await middleware.use(request, {} as never, (failure?: unknown) => {
        error = failure;
      });
      if (error) {
        throw error instanceof Error
          ? error
          : new Error("Authentication failed", { cause: error });
      }
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(options),
      ).getAbility();
      return await callback(em);
    });

  it("stores all three owner kinds in one table and rejects duplicate credentials across kinds", async () => {
    const { account, entity, apiKey } = await issue();
    const em = orm.em.fork();
    const member = em.create(WorkspaceMember, {
      workspace,
      type: "SERVICE_ACCOUNT",
      user: null,
      name: "WorkspaceMember key owner",
    });
    const userKey = em.create(ApiKey, {
      name: "User",
      owner: administrator,
      key: randomUUID(),
    });
    const memberKey = em.create(ApiKey, {
      name: "WorkspaceMember",
      owner: member,
      key: randomUUID(),
    });
    await em.persist([userKey, memberKey]).flush();
    const rows = await em.execute<{ owner_type: string; owner_id: string }[]>(
      "select owner_type, owner_id::text as owner_id from api_key where id in (?, ?, ?) order by owner_type",
      [entity.id, userKey.id, memberKey.id],
    );
    expect(rows).toEqual([
      { owner_type: "system_account", owner_id: account.id },
      { owner_type: "user", owner_id: administrator.id },
      { owner_type: "workspace_member", owner_id: member.id },
    ]);
    await expect(
      em.execute(
        "insert into api_key (name, key, owner_type, owner_id) values ('Duplicate', ?, 'user', ?)",
        [hashApiKey(apiKey), administrator.id],
      ),
    ).rejects.toThrow(/unique/i);
    expect(
      await em.execute(
        "select to_regclass('user_api_key') as user_key, to_regclass('member_api_key') as member_key, to_regclass('system_account_api_key') as system_key",
      ),
    ).toEqual([{ user_key: null, member_key: null, system_key: null }]);
  });

  it("selects a workspace without a user or member and retains platform grant boundaries", async () => {
    const issued = await issue();
    await withKey(issued.apiKey, async (em) => {
      expect(RequestContext.get(User)).toBeNull();
      expect(RequestContext.get(WorkspaceMember)).toBeNull();
      expect(RequestContext.get(Workspace)?.id).toBe(otherWorkspace.id);
      expect(em.getSessionContext()?.variables).toMatchObject({
        "app.auth.user.id": "",
        "app.auth.workspace_member.id": "",
        "app.auth.workspace.id": otherWorkspace.id,
      });
      const service = new WorkspaceService(
        em,
        options,
        createTestAuthContext(em, options),
      );
      const page = await service.getPlatformWorkspaceConnection({ first: 100 });
      expect(page.edges.map(({ node }) => node.id)).toEqual(
        expect.arrayContaining([workspace.id, otherWorkspace.id]),
      );
      expect(
        await service.getPlatformWorkspace(otherWorkspace.id),
      ).toMatchObject({ id: otherWorkspace.id });
      const users = await new UserService(
        em,
        withAuthTestFeatures(options),
        {} as never,
        {} as never,
        createTestAuthContext(em, withAuthTestFeatures(options)),
      ).getUserConnection({ first: 100 });
      expect(users.edges.map(({ node }) => node.id)).toEqual(
        expect.arrayContaining([administrator.id, ordinary.id]),
      );
      const ability = getAuthAbility();
      expect(ability.can("read", User)).toBe(true);
      expect(ability.can("update", User)).toBe(false);
      await expect(
        service.updatePlatformWorkspace(workspace.id, { name: "Denied" }),
      ).rejects.toThrow(/not allowed/i);
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).workspace,
      ).toEqual([]);
    });
  });

  it.each(["ordinary", "system"])(
    "denies %s credentials access to system-account and key management",
    async (kind) => {
      const attempt = async (em: EntityManager) => {
        const accounts = new SystemAccountService(
          em,
          withAuthTestFeatures(options),
        );
        const keys = new SystemApiKeyService(
          em,
          withAuthTestFeatures(options),
          createTestApiKeyService(em, withAuthTestFeatures(options)),
          new SystemAccountService(em, withAuthTestFeatures(options)),
        );
        await expect(
          accounts.createSystemAccount({
            name: "Escalation",
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(/administrator session/i);
        await expect(
          accounts.getSystemAccountConnection({ first: 1 }),
        ).rejects.toThrow(/administrator session/i);
        await expect(
          keys.createSystemApiKey({
            systemAccountId: "1",
            name: "Escalation",
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(/administrator session/i);
      };
      if (kind === "ordinary") {
        await asAdministrator(async (_accounts, _keys, em) => {
          await attempt(em);
        }, ordinary);
      } else {
        await withKey((await issue()).apiKey, attempt);
      }
    },
  );

  it("requires explicit system-key grants; an empty list never inherits account privileges", async () => {
    const { account } = await issue();
    const created = await asAdministrator((_accounts, keys) =>
      keys.createSystemApiKey({
        systemAccountId: account.id,
        name: "No grants",
      }),
    );
    await withKey(created.apiKey, async (em) => {
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).user,
      ).toEqual([]);
      await expect(
        new WorkspaceService(
          em,
          options,
          createTestAuthContext(em, options),
        ).getPlatformWorkspaceConnection({
          first: 1,
        }),
      ).rejects.toThrow(/not allowed/i);
    });
  });

  it("enforces issuer, account and configuration ceilings when issuing or changing system keys", async () => {
    await asAdministrator(async (accounts, keys) => {
      const account = await accounts.createSystemAccount({
        name: "Limited",
        permissions: ["user:read"],
      });
      await expect(
        keys.createSystemApiKey({
          systemAccountId: account.id,
          name: "Too broad",
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed system account/i);
      await expect(
        keys.createSystemApiKey({
          systemAccountId: account.id,
          name: "Config",
          permissions: ["user:delete"],
        }),
      ).rejects.toThrow(/configured allowedPermissions/i);
      const created = await keys.createSystemApiKey({
        systemAccountId: account.id,
        name: "Valid",
        permissions: ["user:read"],
      });
      await expect(
        keys.updateSystemApiKey(created.entity.id, {
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed system account/i);
      expect(
        (await keys.getSystemApiKey(created.entity.id))?.permissions,
      ).toEqual(["user:read"]);
      expect(await keys.getSystemApiKey(created.entity.id)).not.toHaveProperty(
        "key",
      );
    });
  });

  it("recomputes grants after reducing the account ceiling and rejects disabled accounts and keys", async () => {
    const issued = await issue();
    await asAdministrator((accounts) =>
      accounts.updateSystemAccount(issued.account.id, {
        permissions: ["user:read"],
      }),
    );
    await withKey(issued.apiKey, async (em) => {
      expect(
        resolveRequestPermissions(withAuthTestFeatures(options)).user,
      ).toEqual(["user:read"]);
      await expect(
        new WorkspaceService(
          em,
          options,
          createTestAuthContext(em, options),
        ).getPlatformWorkspace(otherWorkspace.id),
      ).rejects.toThrow(/not allowed/i);
    });
    await asAdministrator((accounts) =>
      accounts.updateSystemAccount(issued.account.id, { enabled: false }),
    );
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      /Invalid API key/,
    );
    await asAdministrator((accounts) =>
      accounts.updateSystemAccount(issued.account.id, { enabled: true }),
    );
    await asAdministrator((_accounts, keys) =>
      keys.revokeSystemApiKey(issued.entity.id),
    );
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(/revoked/);
    const firstRevocation = (
      await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)
    ).revokedAt;
    await asAdministrator((_accounts, keys) =>
      keys.revokeSystemApiKey(issued.entity.id),
    );
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)).revokedAt,
    ).toEqual(firstRevocation);
  });

  it("retains system keys for audit after the creator and system account are deleted", async () => {
    const em = orm.em.fork();
    const creator = em.create(User, {
      name: "Creator",
      email: randomUUID() + "@example.test",
      emailVerified: true,
      roles: ["admin"],
    });
    await em.persist(creator).flush();
    const issued = await asAdministrator(async (accounts, keys) => {
      const account = await accounts.createSystemAccount({
        name: "Independent",
        permissions: ["user:read"],
      });
      return {
        account,
        ...(await keys.createSystemApiKey({
          systemAccountId: account.id,
          name: "Independent",
          permissions: ["user:read"],
        })),
      };
    }, creator);
    await em.nativeDelete(User, creator.id);
    expect(
      await em.findOne(SystemAccount, issued.account.id, { refresh: true }),
    ).toMatchObject({ createdBy: null });
    await withKey(issued.apiKey, () => {
      expect(getCurrentApiKey()?.systemAccount?.id).toBe(issued.account.id);
      expect(getCurrentApiKey()?.createdById).toBeNull();
    });
    await asAdministrator((accounts) =>
      accounts.deleteSystemAccount(issued.account.id),
    );
    expect(await em.count(ApiKey, issued.entity.id)).toBe(1);
    expect(
      (await em.findOneOrFail(ApiKey, issued.entity.id, { refresh: true }))
        .revokedAt,
    ).toBeInstanceOf(Date);
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      /API key is revoked/,
    );
  });

  it("applies platform write grants independently of membership and keeps the system identity after tenant deletion", async () => {
    const { apiKey } = await issue([
      "workspace:read-any",
      "workspace:update-any",
      "workspace:delete-any",
    ]);
    const admin = orm.em.fork();
    const tenant = admin.create(Workspace, { name: "Platform-managed tenant" });
    const member = admin.create(WorkspaceMember, {
      workspace: tenant,
      type: "SERVICE_ACCOUNT",
      user: null,
      name: "Tenant automation",
    });
    const memberKey = admin.create(ApiKey, {
      owner: member,
      key: randomUUID(),
      name: "Tenant key",
    });
    await admin.persist(memberKey).flush();
    await withKey(apiKey, async (em) => {
      const service = new WorkspaceService(
        em,
        options,
        createTestAuthContext(em, options),
      );
      expect(
        (
          await service.updatePlatformWorkspace(tenant.id, {
            name: "Renamed tenant",
          })
        ).name,
      ).toBe("Renamed tenant");
      expect((await service.deletePlatformWorkspace(tenant.id)).id).toBe(
        tenant.id,
      );
      expect(getCurrentApiKey()?.ownerType).toBe("system_account");
      expect(await service.getPlatformWorkspace(tenant.id)).toBeNull();
      await expect(
        service.updatePlatformWorkspace(tenant.id, { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(service.deletePlatformWorkspace(tenant.id)).rejects.toThrow(
        /not found/i,
      );
    });
    expect(await admin.count(ApiKey, memberKey.id)).toBe(1);
  });

  it("rejects missing accounts and keys and cannot delegate grants beyond a limited administrator", async () => {
    await asAdministrator(async (accounts, keys) => {
      expect(await accounts.getSystemAccount("9999999999999")).toBeNull();
      expect(await keys.getSystemApiKey("9999999999999")).toBeNull();
      await expect(
        accounts.updateSystemAccount("9999999999999", { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(
        accounts.deleteSystemAccount("9999999999999"),
      ).rejects.toThrow(/not found/i);
      await expect(
        keys.createSystemApiKey({
          systemAccountId: "9999999999999",
          name: "Missing",
        }),
      ).rejects.toThrow(/not found/i);
      await expect(
        keys.updateSystemApiKey("9999999999999", { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(keys.deleteSystemApiKey("9999999999999")).rejects.toThrow(
        /not found/i,
      );
    });
    const configuration: AuthModuleOptions = {
      ...options,
      user: {
        adminRoles: ["operator"],
        roles: {
          operator: [
            "system-account:write",
            "system-account-api-key:write",
            "user:read",
          ],
        },
      },
    };
    const operator = Object.assign(new User(), administrator, {
      roles: ["operator"],
    });
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const accounts = new SystemAccountService(
        em,
        withAuthTestFeatures(configuration),
      );
      await expect(
        accounts.createSystemAccount({
          name: "Excessive",
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed issuer permissions/i);
      const account = await accounts.createSystemAccount({
        name: "Limited issuer",
        permissions: ["user:read"],
      });
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(
        keys.createSystemApiKey({
          systemAccountId: account.id,
          name: "Excessive",
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed issuer permissions/i);
    }, operator);
  });

  it("checks the resulting account grant ceiling when a limited administrator re-enables credentials", async () => {
    const issued = await issue();
    await asAdministrator((accounts) =>
      accounts.updateSystemAccount(issued.account.id, { enabled: false }),
    );
    const configuration: AuthModuleOptions = {
      ...options,
      user: {
        adminRoles: ["operator"],
        roles: { operator: ["system-account:write", "user:read"] },
      },
    };
    const operator = Object.assign(new User(), administrator, {
      roles: ["operator"],
    });
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const accounts = new SystemAccountService(
        em,
        withAuthTestFeatures(configuration),
      );
      await expect(
        accounts.updateSystemAccount(issued.account.id, { enabled: true }),
      ).rejects.toThrow(/exceed issuer permissions/i);
      expect(
        (await orm.em.fork().findOneOrFail(SystemAccount, issued.account.id))
          .enabled,
      ).toBe(false);
      const narrowed = await accounts.updateSystemAccount(issued.account.id, {
        enabled: true,
        permissions: ["user:read"],
      });
      expect(narrowed.enabled).toBe(true);
      expect(narrowed.permissions).toEqual(["user:read"]);
      await accounts.updateSystemAccount(issued.account.id, { enabled: false });
    }, operator);
    // Revocation stays available even if the administrator cannot re-grant the account's permissions.
    await asAdministrator((accounts) =>
      accounts.updateSystemAccount(issued.account.id, {
        enabled: true,
        permissions: ["user:read", "workspace:read-any"],
      }),
    );
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const accounts = new SystemAccountService(
        em,
        withAuthTestFeatures(configuration),
      );
      expect(
        (
          await accounts.updateSystemAccount(issued.account.id, {
            enabled: false,
          })
        ).enabled,
      ).toBe(false);
      await expect(
        accounts.updateSystemAccount(issued.account.id, { enabled: true }),
      ).rejects.toThrow(/exceed issuer permissions/i);
    }, operator);
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      /Invalid API key/,
    );
  });

  it("reloads key grants after locking the account before extending expiration", async () => {
    const issued = await issue();
    await asAdministrator((_accounts, keys) =>
      keys.updateSystemApiKey(issued.entity.id, {
        permissions: ["user:read"],
      }),
    );
    const configuration: AuthModuleOptions = {
      ...options,
      user: {
        adminRoles: ["operator"],
        roles: { operator: ["system-account-api-key:write", "user:read"] },
      },
    };
    const operator = Object.assign(new User(), administrator, {
      roles: ["operator"],
    });
    let changed = false;
    orm.em.getEventManager().registerSubscriber({
      getSubscribedEntities: () => [SystemAccount],
      async onLoad({ entity, em }: EventArgs<SystemAccount>) {
        if (!changed && entity.id === issued.account.id) {
          changed = true;
          // Reproduce a stored key changing after hydration, before the account lock.
          // This uses a database write so a stale managed instance cannot satisfy the check.
          await em.nativeUpdate(ApiKey, issued.entity.id, {
            permissions: ["workspace:read-any"],
          });
        }
      },
    });
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(
        keys.updateSystemApiKey(issued.entity.id, {
          expiresAt: new Date(Date.now() + 60000),
        }),
      ).rejects.toThrow(/exceed issuer permissions/i);
    }, operator);
    expect(changed).toBe(true);
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)).revokedAt,
    ).toBeNull();
  });

  it("honors conditional account and proposed-key restrictions before persisting changes", async () => {
    const issued = await issue();
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemAccount, { name: "Blocked" });
        cannot("write", SystemApiKey, { name: "Blocked" });
      },
    };
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const accounts = new SystemAccountService(
        em,
        withAuthTestFeatures(configuration),
      );
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(
        accounts.createSystemAccount({ name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        accounts.updateSystemAccount(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.createSystemApiKey({
          systemAccountId: issued.account.id,
          name: "Blocked",
        }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.updateSystemApiKey(issued.entity.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
    });
    expect(
      (await orm.em.fork().findOneOrFail(SystemAccount, issued.account.id))
        .name,
    ).toBe(issued.account.name);
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)).name,
    ).toBe("Integration");
  });

  it("keeps denied changes out of an unscoped caller's later flush", async () => {
    const issued = await issue();
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemAccount, { name: "Blocked" });
        cannot("write", SystemApiKey, { name: "Blocked" });
      },
    };
    await asAdministrator(async () => {
      // Exercise runAuthQuery's unscoped fast path and a subsequent unrelated flush.
      const em = orm.em.fork({ useContext: false });
      RequestContext.set(EntityManager, em);
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const accounts = new SystemAccountService(
        em,
        withAuthTestFeatures(configuration),
      );
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(
        accounts.createSystemAccount({ name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        accounts.updateSystemAccount(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.createSystemApiKey({
          systemAccountId: issued.account.id,
          name: "Blocked",
        }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.updateSystemApiKey(issued.entity.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await em.flush();
    });
    const em = orm.em.fork();
    expect(await em.count(SystemAccount, { name: "Blocked" })).toBe(0);
    expect(await em.count(ApiKey, { name: "Blocked" })).toBe(0);
    expect(
      (await em.findOneOrFail(SystemAccount, issued.account.id)).name,
    ).toBe(issued.account.name);
    expect((await em.findOneOrFail(ApiKey, issued.entity.id)).name).toBe(
      "Integration",
    );
  });

  it("requires a human session even when a user API key belongs to an administrator", async () => {
    const em = orm.em.fork();
    const plaintext = randomUUID();
    const key = em.create(ApiKey, {
      name: "Administrator API key",
      owner: administrator,
      key: hashApiKey(plaintext),
    });
    await em.persist(key).flush();
    await withKey(plaintext, async (scoped) => {
      expect(RequestContext.get(User)?.id).toBe(administrator.id);
      await expect(
        new SystemAccountService(
          scoped,
          withAuthTestFeatures(options),
        ).createSystemAccount({
          name: "Denied",
        }),
      ).rejects.toThrow(/session/i);
      await expect(
        new SystemApiKeyService(
          scoped,
          withAuthTestFeatures(options),
          createTestApiKeyService(scoped, withAuthTestFeatures(options)),
          new SystemAccountService(scoped, withAuthTestFeatures(options)),
        ).createSystemApiKey({ systemAccountId: "1", name: "Denied" }),
      ).rejects.toThrow(/session/i);
    });
  });

  it("rejects disabled administration and missing human sessions despite administrator context", async () => {
    await asAdministrator(async (accounts, _keys, em) => {
      await expect(
        new SystemApiKeyService(
          em,
          {
            apiKey: { enabled: true, system: { enabled: true } },
          },
          createTestApiKeyService(em, {
            apiKey: { enabled: true, system: { enabled: true } },
          }),
          new SystemAccountService(em, {
            apiKey: { enabled: true, system: { enabled: true } },
          }),
        ).getSystemApiKeyPermissions(),
      ).rejects.toThrow("Administration is disabled");
      RequestContext.set(Session, null);
      await expect(
        accounts.createSystemAccount({ name: "No session" }),
      ).rejects.toThrow(/administrator session/i);
    });
  });

  it("checks proposed platform workspace changes before committing them", async () => {
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("update-any", Workspace, { name: "Blocked" });
      },
    };
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      await expect(
        new WorkspaceService(
          em,
          configuration,
          createTestAuthContext(em, configuration),
        ).updatePlatformWorkspace(otherWorkspace.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
    });
    expect(
      (await orm.em.fork().findOneOrFail(Workspace, otherWorkspace.id)).name,
    ).toBe("Second tenant");
  });

  it("isolates system account rows and other credentials under request-role RLS", async () => {
    const issued = await issue();
    await withKey(issued.apiKey, async (em) => {
      expect(await em.find(SystemAccount, {})).toEqual([]);
      expect(await em.find(ApiKey, {})).toEqual([]);
      await em.execute(
        "update api_key set permissions = array['user:delete'] where id = ?",
        [issued.entity.id],
      );
      await em.nativeDelete(ApiKey, issued.entity.id);
      await expect(
        em.execute(
          "insert into api_key (name, key, owner_type, owner_id) values ('Denied', ?, 'system_account', ?)",
          [randomUUID(), issued.account.id],
        ),
      ).rejects.toThrow(/row.level security/i);
    });
    const stored = await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id);
    expect(stored.permissions).toEqual(["user:read", "workspace:read-any"]);
    const authentication = new ApiKeyAuthenticationService(
      orm.em.fork({
        session: {
          role: "authenticated",
        },
      }),
      withAuthTestFeatures(options),
    );
    await authentication.captureUsage(stored)();
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, stored.id)).lastUsedAt,
    ).toBeInstanceOf(Date);
  });

  it.each(
    ["user", "member", "workspace", "system_account"].flatMap((kind) => [
      { kind, removal: "SQL" },
      { kind, removal: "ORM" },
    ]),
  )(
    "retains $kind-key audit metadata after $removal deletion with a warm identity map",
    async ({ kind, removal }) => {
      const em = orm.em.fork();
      const tenant = em.create(Workspace, { name: "Audit tenant" });
      const owner =
        kind === "user"
          ? em.create(User, {
              name: "Audit user",
              email: randomUUID() + "@example.test",
              emailVerified: true,
            })
          : kind === "system_account"
            ? em.create(SystemAccount, {
                name: "Audit system",
                permissions: ["user:read"],
              })
            : em.create(WorkspaceMember, {
                workspace: tenant,
                name: "Audit member",
                type: "SERVICE_ACCOUNT",
                user: null,
              });
      const plaintext = randomUUID();
      const credential = em.create(ApiKey, {
        owner,
        name: "Retained audit key",
        key: hashApiKey(plaintext),
      });
      await em.persist(credential).flush();
      const auth = new ApiKeyAuthenticationService(
        em,
        withAuthTestFeatures(options),
      );
      await expect(auth.validate(plaintext)).resolves.toMatchObject({
        apiKey: { id: credential.id },
      });
      if (removal === "ORM") {
        await em.remove(kind === "workspace" ? tenant : owner).flush();
      } else if (kind === "user") {
        await em.nativeDelete(User, owner.id);
      } else if (kind === "system_account") {
        await em.nativeDelete(SystemAccount, owner.id);
      } else if (kind === "workspace") {
        await em.nativeDelete(Workspace, tenant.id);
      } else {
        await em.nativeDelete(WorkspaceMember, owner.id);
      }
      await expect(auth.validate(plaintext)).rejects.toThrow("Invalid API key");
      const [audit] = await em.execute(
        "select name, owner_type, owner_id::text, revoked_at, last_used_at from api_key where id = ?",
        [credential.id],
      );
      expect(audit).toEqual({
        name: "Retained audit key",
        owner_type: ["workspace", "member"].includes(kind)
          ? "workspace_member"
          : kind,
        owner_id: owner.id,
        revoked_at: null,
        last_used_at: null,
      });
    },
  );
  it("preserves the first revocation during concurrent requests and refreshes warmed authentication state", async () => {
    const issued = await issue(["user:read"]);
    const auth = new ApiKeyAuthenticationService(
      orm.em.fork(),
      withAuthTestFeatures(options),
    );
    await expect(auth.validate(issued.apiKey)).resolves.toMatchObject({
      apiKey: { id: issued.entity.id },
    });
    const original = await orm.em
      .fork()
      .findOneOrFail(ApiKey, issued.entity.id);
    const first = orm.em.fork();
    const second = orm.em.fork();
    const snapshots = await Promise.all([
      first.findOneOrFail(ApiKey, issued.entity.id),
      second.findOneOrFail(ApiKey, issued.entity.id),
    ]);
    const results = await asAdministrator(
      async () =>
        await Promise.all([
          createTestApiKeyService(first, withAuthTestFeatures(options)).revoke(
            snapshots[0],
          ),
          createTestApiKeyService(second, withAuthTestFeatures(options)).revoke(
            snapshots[1],
          ),
        ]),
    );
    expect(results[0].revokedAt).toBeInstanceOf(Date);
    expect(results[1].revokedAt).toEqual(results[0].revokedAt);
    await expect(auth.validate(issued.apiKey)).rejects.toThrow(
      "API key is revoked",
    );
    await asAdministrator(async (accounts, keys) => {
      await keys.updateSystemApiKey(issued.entity.id, {
        name: "Revoked audit key",
        expiresAt: null,
      });
      await accounts.deleteSystemAccount(issued.account.id);
    });
    const retained = await orm.em
      .fork()
      .findOneOrFail(ApiKey, issued.entity.id);
    expect(retained).toMatchObject({
      name: "Revoked audit key",
      key: original.key,
      permissions: original.permissions,
      lastUsedAt: original.lastUsedAt,
      revokedAt: results[0].revokedAt,
    });
    expect(retained.owner.id).toBe(issued.account.id);
    expect(await orm.em.fork().count(ApiKey, issued.entity.id)).toBe(1);
  });

  it("can revoke an unrevoked audit key even after direct deletion of its system account", async () => {
    const issued = await issue(["user:read"]);
    await orm.em.fork().nativeDelete(SystemAccount, issued.account.id);
    await asAdministrator(async (_accounts, keys) => {
      expect(
        (await keys.revokeSystemApiKey(issued.entity.id)).revokedAt,
      ).toBeInstanceOf(Date);
    });
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      "API key is revoked",
    );
  });

  it("rejects revocation when the record was deleted after it was read", async () => {
    const issued = await issue(["user:read"]);
    const em = orm.em.fork();
    const snapshot = await em.findOneOrFail(ApiKey, issued.entity.id);
    await orm.em.fork().nativeDelete(ApiKey, issued.entity.id);
    await asAdministrator(async () => {
      await expect(
        createTestApiKeyService(em, withAuthTestFeatures(options)).revoke(
          snapshot,
        ),
      ).rejects.toThrow("API key not found");
    });
    expect(snapshot.revokedAt).toBeNull();
    expect(await orm.em.fork().count(ApiKey, issued.entity.id)).toBe(0);
  });

  it("enforces revocation field restrictions before writing an audit timestamp", async () => {
    const issued = await issue(["user:read"]);
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemApiKey, ["revokedAt"]);
      },
    };
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(keys.revokeSystemApiKey(issued.entity.id)).rejects.toThrow(
        /not allowed/i,
      );
      await expect(
        keys.updateSystemApiKey(issued.entity.id, {
          name: "Allowed audit edit",
        }),
      ).resolves.toMatchObject({ name: "Allowed audit edit" });
    });
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)).revokedAt,
    ).toBeNull();
    await expect(withKey(issued.apiKey, () => null)).resolves.toBeNull();
  });

  it("rolls back account deletion and key revocation together with the surrounding transaction", async () => {
    const issued = await issue(["user:read"]);
    await asAdministrator(async () => {
      const em = orm.em.fork({ useContext: false });
      RequestContext.set(EntityManager, em);
      await expect(
        em.transactional(async (tx) => {
          await new SystemAccountService(
            tx,
            withAuthTestFeatures(options),
          ).deleteSystemAccount(issued.account.id);
          expect(
            (
              await tx.findOneOrFail(ApiKey, issued.entity.id, {
                refresh: true,
              })
            ).revokedAt,
          ).toBeInstanceOf(Date);
          throw new Error("Abort surrounding operation");
        }),
      ).rejects.toThrow("Abort surrounding operation");
    });
    const em = orm.em.fork();
    expect(await em.findOne(SystemAccount, issued.account.id)).not.toBeNull();
    expect(
      (await em.findOneOrFail(ApiKey, issued.entity.id)).revokedAt,
    ).toBeNull();
    await expect(withKey(issued.apiKey, () => null)).resolves.toBeNull();
  });

  it("allows audit metadata changes and revoking an orphan, but rejects grant changes", async () => {
    const issued = await issue(["user:read"]);
    const original = await orm.em
      .fork()
      .findOneOrFail(ApiKey, issued.entity.id);
    const unrelated = await issue(["user:read"]);
    const seed = orm.em.fork();
    const sibling = seed.create(ApiKey, {
      name: "Sibling credential",
      key: hashApiKey(randomUUID()),
      owner: issued.account,
      permissions: ["user:read"],
    });
    const otherScope = seed.create(ApiKey, {
      name: "Other owner type",
      key: hashApiKey(randomUUID()),
      owner: administrator,
      permissions: [],
    });
    await seed.persist([sibling, otherScope]).flush();
    // Match the numeric owner ID across different types to prove discriminator isolation.
    await seed.execute("update api_key set owner_id = ? where id = ?", [
      issued.account.id,
      otherScope.id,
    ]);
    await asAdministrator((accounts) =>
      accounts.deleteSystemAccount(issued.account.id),
    );
    const read = orm.em.fork();
    expect(await read.findOne(SystemAccount, issued.account.id)).toBeNull();
    expect(
      (await read.findOneOrFail(ApiKey, sibling.id)).revokedAt,
    ).toBeInstanceOf(Date);
    for (const id of [unrelated.entity.id, otherScope.id]) {
      expect((await read.findOneOrFail(ApiKey, id)).revokedAt).toBeNull();
    }
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      "API key is revoked",
    );
    await asAdministrator(async (_accounts, keys) => {
      await expect(
        keys.updateSystemApiKey(issued.entity.id, {
          name: "Retained deployment",
        }),
      ).resolves.toMatchObject({ name: "Retained deployment" });
      await expect(
        keys.revokeSystemApiKey(issued.entity.id),
      ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
      for (const input of [
        { permissions: [] },
        { permissions: null },
        { permissions: ["user:read"] },
      ]) {
        await expect(
          keys.updateSystemApiKey(issued.entity.id, input),
        ).rejects.toThrow("System account not found");
      }
    });
    const retained = await orm.em
      .fork()
      .findOneOrFail(ApiKey, issued.entity.id);
    expect(retained).toMatchObject({
      name: "Retained deployment",
      revokedAt: expect.any(Date),
      key: original.key,
      permissions: original.permissions,
    });
    expect(retained.owner.id).toBe(issued.account.id);
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      "API key is revoked",
    );
  });

  it("still enforces field restrictions when updating an orphan's audit metadata", async () => {
    const issued = await issue(["user:read"]);
    await asAdministrator((accounts) =>
      accounts.deleteSystemAccount(issued.account.id),
    );
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemApiKey, ["name"]);
      },
    };
    await asAdministrator(async (_accounts, _keys, em) => {
      createTestAuthContext(
        undefined,
        withAuthTestFeatures(configuration),
      ).refresh();
      const keys = new SystemApiKeyService(
        em,
        withAuthTestFeatures(configuration),
        createTestApiKeyService(em, withAuthTestFeatures(configuration)),
        new SystemAccountService(em, withAuthTestFeatures(configuration)),
      );
      await expect(
        keys.updateSystemApiKey(issued.entity.id, { name: "Forbidden rename" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.revokeSystemApiKey(issued.entity.id),
      ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
    });
    expect(
      (await orm.em.fork().findOneOrFail(ApiKey, issued.entity.id)).name,
    ).toBe("Integration");
  });

  it.each(["user", "workspace_member", "system_account"])(
    "rejects a retained %s key with a missing owner without deleting its audit row",
    async (type) => {
      const em = orm.em.fork();
      const plaintext = randomUUID();
      const [{ id }] = await em.execute<{ id: string }[]>(
        "insert into api_key (name, key, owner_type, owner_id) values ('Retained audit key', ?, ?, ?) returning id::text as id",
        [hashApiKey(plaintext), type, "99999999999999"],
      );
      await expect(withKey(plaintext, () => null)).rejects.toThrow(
        "Invalid API key",
      );
      const [audit] = await em.execute(
        "select name, owner_type, owner_id::text, revoked_at, last_used_at from api_key where id = ?",
        [id],
      );
      expect(audit).toEqual({
        name: "Retained audit key",
        owner_type: type,
        owner_id: "99999999999999",
        revoked_at: null,
        last_used_at: null,
      });
    },
  );
});
