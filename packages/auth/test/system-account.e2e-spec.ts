import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { EntityManager, MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
import type { Request } from "express";

import { AuthMiddleware } from "../src/auth.middleware.js";
import type { AuthModuleOptions } from "../src/auth-module-options.interface.js";
import {
  ApiKeyEntity,
  getAuthEntities,
  Member,
  SystemAccount,
  User,
  Workspace,
} from "../src/entities/index.js";
import { Session } from "../src/entities/session.entity.js";
import { SystemAccountApiKey } from "../src/entities/system-account-api-key.entity.js";
import { ApiKeyAuthenticationService } from "../src/infrastructure/api-key-authentication.service.js";
import { RequestIdentity } from "../src/infrastructure/request-identity.js";
import type { SessionService } from "../src/services/session.service.js";
import { SystemAccountService } from "../src/services/system-account.service.js";
import { SystemAccountApiKeyService } from "../src/services/system-account-api-key.service.js";
import { UserService } from "../src/services/user.service.js";
import { WorkspaceService } from "../src/services/workspace.service.js";
import { hashApiKey } from "../src/utils/api-key-credential.util.js";
import { getAuthAbility } from "../src/utils/get-auth-ability.util.js";
import { getCurrentApiKey } from "../src/utils/get-current-api-key.util.js";
import { resolveRequestPermissions } from "../src/utils/resolve-request-permissions.util.js";

const options: AuthModuleOptions = {
  workspace: { enabled: true },
  apiKey: {
    systemAccount: {
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
      entities: getAuthEntities(options),
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
      keys: SystemAccountApiKeyService,
      em: EntityManager,
    ) => Promise<T>,
    user = administrator,
  ) =>
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const em = orm.em.fork({
        session: {
          role: "authenticated",
          variables: { "app.user.id": user.id },
        },
      });
      RequestContext.set(EntityManager, em);
      RequestContext.set(User, user);
      RequestContext.set(Session, Object.assign(new Session(), { user }));
      RequestIdentity.prepare(options);
      return await callback(
        new SystemAccountService(em, options),
        new SystemAccountApiKeyService(em, options),
        em,
      );
    });

  const issue = async (permissions = ["user:read", "workspace:read-any"]) =>
    await asAdministrator(async (accounts, keys) => {
      const account = await accounts.createSystemAccount({
        name: randomUUID(),
        permissions,
      });
      return {
        account,
        ...(await keys.createSystemAccountApiKey(account.id, {
          name: "Integration",
          permissions,
        })),
      };
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
        options,
        {
          getCurrentAuthenticatedSession: () => Promise.resolve(null),
        } as unknown as SessionService,
        new ApiKeyAuthenticationService(orm.em.fork(), options),
        em,
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
      RequestIdentity.prepare(options);
      return await callback(em);
    });

  it("stores all three owner kinds in one table and rejects duplicate credentials across kinds", async () => {
    const { account, entity, apiKey } = await issue();
    const em = orm.em.fork();
    const member = em.create(Member, {
      workspace,
      type: "SERVICE_ACCOUNT",
      user: null,
      name: "Member key owner",
    });
    const userKey = em.create(ApiKeyEntity, {
      name: "User",
      owner: administrator,
      key: randomUUID(),
    });
    const memberKey = em.create(ApiKeyEntity, {
      name: "Member",
      owner: member,
      key: randomUUID(),
    });
    await em.persist([userKey, memberKey]).flush();
    const rows = await em.execute<{ owner_type: string; owner_id: string }[]>(
      "select owner_type, owner_id::text as owner_id from api_key where id in (?, ?, ?) order by owner_type",
      [entity.id, userKey.id, memberKey.id],
    );
    expect(rows).toEqual([
      { owner_type: "member", owner_id: member.id },
      { owner_type: "system_account", owner_id: account.id },
      { owner_type: "user", owner_id: administrator.id },
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

  it("authenticates without a user, member or selected workspace and reads all tenants only through granted platform APIs", async () => {
    const issued = await issue();
    await withKey(issued.apiKey, async (em) => {
      expect(RequestContext.get(User)).toBeNull();
      expect(RequestContext.get(Member)).toBeNull();
      expect(RequestContext.get(Workspace)).toBeNull();
      expect(em.getSessionContext()?.variables).toMatchObject({
        "app.user.id": "",
        "app.member.id": "",
        "app.workspace.id": "",
        "app.system_account.id": issued.account.id,
      });
      const service = new WorkspaceService(em, options);
      const page = await service.getPlatformWorkspaceConnection({ first: 100 });
      expect(page.edges.map(({ node }) => node.id)).toEqual(
        expect.arrayContaining([workspace.id, otherWorkspace.id]),
      );
      expect(
        await service.getPlatformWorkspace(otherWorkspace.id),
      ).toMatchObject({ id: otherWorkspace.id });
      const users = await new UserService(
        em,
        options,
        {} as never,
        {} as never,
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
      expect(resolveRequestPermissions(options).workspace).toEqual([]);
    });
  });

  it.each(["ordinary", "system"])(
    "denies %s credentials access to system-account and key management",
    async (kind) => {
      const attempt = async (em: EntityManager) => {
        const accounts = new SystemAccountService(em, options);
        const keys = new SystemAccountApiKeyService(em, options);
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
          keys.createSystemAccountApiKey("1", {
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
      keys.createSystemAccountApiKey(account.id, { name: "No grants" }),
    );
    await withKey(created.apiKey, async (em) => {
      expect(resolveRequestPermissions(options).user).toEqual([]);
      await expect(
        new WorkspaceService(em, options).getPlatformWorkspaceConnection({
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
        keys.createSystemAccountApiKey(account.id, {
          name: "Too broad",
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed system account/i);
      await expect(
        keys.createSystemAccountApiKey(account.id, {
          name: "Config",
          permissions: ["user:delete"],
        }),
      ).rejects.toThrow(/configured allowedPermissions/i);
      const created = await keys.createSystemAccountApiKey(account.id, {
        name: "Valid",
        permissions: ["user:read"],
      });
      await expect(
        keys.updateSystemAccountApiKey(created.entity.id, {
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed system account/i);
      expect(
        (await keys.getSystemAccountApiKey(created.entity.id))?.permissions,
      ).toEqual(["user:read"]);
      expect(
        await keys.getSystemAccountApiKey(created.entity.id),
      ).not.toHaveProperty("key");
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
      expect(resolveRequestPermissions(options).user).toEqual(["user:read"]);
      await expect(
        new WorkspaceService(em, options).getPlatformWorkspace(
          otherWorkspace.id,
        ),
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
      keys.updateSystemAccountApiKey(issued.entity.id, { enabled: false }),
    );
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      /disabled/,
    );
    await expect(
      asAdministrator((_accounts, keys) =>
        keys.updateSystemAccountApiKey(issued.entity.id, { enabled: true }),
      ),
    ).rejects.toThrow(/exceed system account/);
  });

  it("keeps system identities and keys after deleting their creator and cleans them up when the system account is deleted", async () => {
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
        ...(await keys.createSystemAccountApiKey(account.id, {
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
    expect(await em.count(ApiKeyEntity, issued.entity.id)).toBe(0);
    await expect(withKey(issued.apiKey, () => null)).rejects.toThrow(
      /Invalid API key/,
    );
  });

  it("rejects reuse of privileged owner-cleanup functions by an unexpected trigger", async () => {
    const em = orm.em.fork();
    const key = em.create(ApiKeyEntity, {
      owner: administrator,
      name: "Cleanup guard",
      key: randomUUID(),
    });
    await em.persist(key).flush();
    await em.execute(
      'create trigger cleanup_probe after update on "user" for each row execute function public.user_user_api_key_cleanup_fn()',
    );
    try {
      await expect(
        em.execute('update "user" set name = name where id = ?', [
          administrator.id,
        ]),
      ).rejects.toThrow(/Unexpected API-key trigger target/);
      expect(await em.count(ApiKeyEntity, key.id)).toBe(1);
    } finally {
      await em.execute('drop trigger cleanup_probe on "user"');
    }
  });

  it("applies platform write grants independently of membership and keeps the system identity after tenant deletion", async () => {
    const { apiKey } = await issue([
      "workspace:read-any",
      "workspace:update-any",
      "workspace:delete-any",
    ]);
    const admin = orm.em.fork();
    const tenant = admin.create(Workspace, { name: "Platform-managed tenant" });
    const member = admin.create(Member, {
      workspace: tenant,
      type: "SERVICE_ACCOUNT",
      user: null,
      name: "Tenant automation",
    });
    const memberKey = admin.create(ApiKeyEntity, {
      owner: member,
      key: randomUUID(),
      name: "Tenant key",
    });
    await admin.persist(memberKey).flush();
    await withKey(apiKey, async (em) => {
      const service = new WorkspaceService(em, options);
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
    expect(await admin.count(ApiKeyEntity, memberKey.id)).toBe(0);
  });

  it("rejects missing accounts and keys and cannot delegate grants beyond a limited administrator", async () => {
    await asAdministrator(async (accounts, keys) => {
      expect(await accounts.getSystemAccount("9999999999999")).toBeNull();
      expect(await keys.getSystemAccountApiKey("9999999999999")).toBeNull();
      await expect(
        accounts.updateSystemAccount("9999999999999", { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(
        accounts.deleteSystemAccount("9999999999999"),
      ).rejects.toThrow(/not found/i);
      await expect(
        keys.createSystemAccountApiKey("9999999999999", { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(
        keys.updateSystemAccountApiKey("9999999999999", { name: "Missing" }),
      ).rejects.toThrow(/not found/i);
      await expect(
        keys.deleteSystemAccountApiKey("9999999999999"),
      ).rejects.toThrow(/not found/i);
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
      RequestIdentity.refresh(configuration);
      const accounts = new SystemAccountService(em, configuration);
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
      const keys = new SystemAccountApiKeyService(em, configuration);
      await expect(
        keys.createSystemAccountApiKey(account.id, {
          name: "Excessive",
          permissions: ["workspace:read-any"],
        }),
      ).rejects.toThrow(/exceed issuer permissions/i);
    }, operator);
  });

  it("honors conditional account and proposed-key restrictions before persisting changes", async () => {
    const issued = await issue();
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemAccount, { name: "Blocked" });
        cannot("write", SystemAccountApiKey, { name: "Blocked" });
      },
    };
    await asAdministrator(async (_accounts, _keys, em) => {
      RequestIdentity.refresh(configuration);
      const accounts = new SystemAccountService(em, configuration);
      const keys = new SystemAccountApiKeyService(em, configuration);
      await expect(
        accounts.createSystemAccount({ name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        accounts.updateSystemAccount(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.createSystemAccountApiKey(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.updateSystemAccountApiKey(issued.entity.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
    });
    expect(
      (await orm.em.fork().findOneOrFail(SystemAccount, issued.account.id))
        .name,
    ).toBe(issued.account.name);
    expect(
      (await orm.em.fork().findOneOrFail(ApiKeyEntity, issued.entity.id)).name,
    ).toBe("Integration");
  });

  it("keeps denied changes out of an unscoped caller's later flush", async () => {
    const issued = await issue();
    const configuration: AuthModuleOptions = {
      ...options,
      buildAbility: ({ cannot }) => {
        cannot("write", SystemAccount, { name: "Blocked" });
        cannot("write", SystemAccountApiKey, { name: "Blocked" });
      },
    };
    await asAdministrator(async () => {
      // Exercise runAuthQuery's unscoped fast path and a subsequent unrelated flush.
      const em = orm.em.fork({ useContext: false });
      RequestContext.set(EntityManager, em);
      RequestIdentity.refresh(configuration);
      const accounts = new SystemAccountService(em, configuration);
      const keys = new SystemAccountApiKeyService(em, configuration);
      await expect(
        accounts.createSystemAccount({ name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        accounts.updateSystemAccount(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.createSystemAccountApiKey(issued.account.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await expect(
        keys.updateSystemAccountApiKey(issued.entity.id, { name: "Blocked" }),
      ).rejects.toThrow(/not allowed/i);
      await em.flush();
    });
    const em = orm.em.fork();
    expect(await em.count(SystemAccount, { name: "Blocked" })).toBe(0);
    expect(await em.count(ApiKeyEntity, { name: "Blocked" })).toBe(0);
    expect(
      (await em.findOneOrFail(SystemAccount, issued.account.id)).name,
    ).toBe(issued.account.name);
    expect((await em.findOneOrFail(ApiKeyEntity, issued.entity.id)).name).toBe(
      "Integration",
    );
  });

  it("requires a human session even when a user API key belongs to an administrator", async () => {
    const em = orm.em.fork();
    const plaintext = randomUUID();
    const key = em.create(ApiKeyEntity, {
      name: "Administrator API key",
      owner: administrator,
      key: hashApiKey(plaintext),
    });
    await em.persist(key).flush();
    await withKey(plaintext, async (scoped) => {
      expect(RequestContext.get(User)?.id).toBe(administrator.id);
      await expect(
        new SystemAccountService(scoped, options).createSystemAccount({
          name: "Denied",
        }),
      ).rejects.toThrow(/session/i);
      await expect(
        new SystemAccountApiKeyService(
          scoped,
          options,
        ).createSystemAccountApiKey("1", { name: "Denied" }),
      ).rejects.toThrow(/session/i);
    });
  });

  it("rejects administrator context without a human session", async () => {
    await asAdministrator(async (accounts) => {
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
      RequestIdentity.refresh(configuration);
      await expect(
        new WorkspaceService(em, configuration).updatePlatformWorkspace(
          otherWorkspace.id,
          { name: "Blocked" },
        ),
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
      expect(await em.find(ApiKeyEntity, {})).toEqual([]);
      await em.execute(
        "update api_key set permissions = array['user:delete'] where id = ?",
        [issued.entity.id],
      );
      await em.nativeDelete(ApiKeyEntity, issued.entity.id);
      await expect(
        em.execute(
          "insert into api_key (name, key, owner_type, owner_id) values ('Denied', ?, 'system_account', ?)",
          [randomUUID(), issued.account.id],
        ),
      ).rejects.toThrow(/row.level security/i);
    });
    const stored = await orm.em
      .fork()
      .findOneOrFail(ApiKeyEntity, issued.entity.id);
    expect(stored.permissions).toEqual(["user:read", "workspace:read-any"]);
    const authentication = new ApiKeyAuthenticationService(
      orm.em.fork({
        session: {
          role: "authenticated",
          variables: { "app.system_account.id": issued.account.id },
        },
      }),
      options,
    );
    await authentication.captureUsage(stored)();
    expect(
      (await orm.em.fork().findOneOrFail(ApiKeyEntity, stored.id)).lastUsedAt,
    ).toBeInstanceOf(Date);
  });

  it.each(["user", "member", "system_account"])(
    "rejects a dangling %s owner even for raw SQL and cascades only matching owner types",
    async (type) => {
      const em = orm.em.fork();
      await expect(
        em.execute(
          "insert into api_key (name, key, owner_type, owner_id) values ('Dangling', ?, ?, ?)",
          [randomUUID(), type, "99999999999999"],
        ),
      ).rejects.toThrow(/owner does not exist/i);
    },
  );
});
