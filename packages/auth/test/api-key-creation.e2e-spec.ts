import { EntityManager } from "@mikro-orm/core";
import { MikroORM } from "@mikro-orm/pglite";
import { getDatabaseConfig } from "@nest-boot/database";
import { RequestContext } from "@nest-boot/request-context";

import { SystemAccountService } from "../src/admin/services/system-account.service.js";
import { ApiKey } from "../src/api-key/entities/api-key.entity.js";
import { SystemAccount } from "../src/api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../src/api-key/objects/system-api-key.object.js";
import { WorkspaceApiKey } from "../src/api-key/objects/workspace-api-key.object.js";
import { ApiKeyService } from "../src/api-key/services/api-key.service.js";
import { SystemApiKeyService } from "../src/api-key/services/system-api-key.service.js";
import { WorkspaceApiKeyService } from "../src/api-key/services/workspace-api-key.service.js";
import { AuthContext } from "../src/core/auth-context.js";
import { Session } from "../src/core/entities/session.entity.js";
import { User } from "../src/core/entities/user.entity.js";
import type { AuthModuleOptions } from "../src/core/interfaces/auth-module-options.interface.js";
import { entities, workspaceEntities } from "../src/index.js";
import { Workspace } from "../src/workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../src/workspace/entities/workspace-member.entity.js";
import { WorkspaceMemberService } from "../src/workspace/services/workspace-member.service.js";
import { withAuthTestFeatures } from "./fixtures/enabled-auth-features.fixture.js";

const baseOptions = withAuthTestFeatures({ workspace: { enabled: true } });

describe("atomic API key and service-account creation", () => {
  let orm: MikroORM;
  let user: User;
  let workspace: Workspace;
  let member: WorkspaceMember;
  beforeAll(async () => {
    const { metadataProvider } = await getDatabaseConfig();
    orm = await MikroORM.init({
      dbName: "memory://",
      metadataProvider,
      metadataCache: { enabled: false },
      entities: [...entities, ...workspaceEntities],
      context: () =>
        RequestContext.isActive()
          ? RequestContext.get(EntityManager)
          : undefined,
    });
    for (const role of ["authenticated", "anonymous"]) {
      await orm.em.execute(`create role ${role} nologin noinherit`);
    }
    await orm.em.execute("grant authenticated, anonymous to current_user");
    await orm.em.execute(
      "grant usage on schema public to authenticated, anonymous",
    );
    await orm.em.execute(
      "alter default privileges in schema public grant all on tables to authenticated, anonymous",
    );
    await orm.schema.create();
    const em = orm.em.fork();
    user = em.create(User, {
      name: "Administrator",
      email: "atomic@example.test",
      roles: ["admin"],
      emailVerified: true,
    });
    workspace = em.create(Workspace, { name: "Atomic workspace" });
    member = em.create(WorkspaceMember, {
      name: "Owner",
      user,
      workspace,
      roles: ["owner"],
      status: "ACTIVE",
    });
    await em.persist([user, workspace, member]).flush();
  });
  afterAll(async () => {
    await orm?.close(true);
  });

  /**
   * Executes real domain services with one authenticated request manager.
   * @param run - Creation or rollback operation to verify.
   * @param options - Permission and feature configuration for the request.
   * @returns Result of the domain operation.
   */
  async function inRequest<T>(
    run: (services: {
      system: SystemApiKeyService;
      workspace: WorkspaceApiKeyService;
      em: EntityManager;
    }) => Promise<T>,
    options: AuthModuleOptions = baseOptions,
  ) {
    return await RequestContext.run(
      new RequestContext({ type: "test" }),
      async () => {
        const em = orm.em.fork();
        RequestContext.set(EntityManager, em);
        const context = new AuthContext(orm.em, options);
        context.initialize({
          user,
          workspace,
          member,
          session: Object.assign(new Session(), { user }),
        });
        const persistence = new ApiKeyService(orm.em, context);
        return await run({
          system: new SystemApiKeyService(
            orm.em,
            options,
            persistence,
            new SystemAccountService(orm.em, options),
          ),
          workspace: new WorkspaceApiKeyService(
            orm.em,
            options,
            persistence,
            new WorkspaceMemberService(orm.em, options, context),
          ),
          em,
        });
      },
    );
  }
  /**
   * Reads committed records outside request-role restrictions.
   * @returns Isolated base-role entity manager.
   */
  function reader() {
    const em = orm.em.fork();
    em.clearSessionContext();
    return em;
  }

  it("creates a system account and key from one input", async () => {
    const name = crypto.randomUUID();
    const result = await inRequest(({ system }) =>
      system.createSystemApiKey({ name, permissions: ["user:read"] }),
    );
    const account = await reader().findOneOrFail(
      SystemAccount,
      result.entity.systemAccountId,
    );
    expect(account).toMatchObject({
      name,
      enabled: true,
      permissions: ["user:read"],
    });
    expect(account.createdBy?.id).toBe(user.id);
    expect(result.entity).not.toHaveProperty("key");
    expect(
      await reader().count(ApiKey, {
        ownerType: "system_account",
        owner: account,
      }),
    ).toBe(1);
  });

  it.each([{ permissions: [] }, { permissions: ["workspace:read"] }])(
    "creates a workspace service account with the intended grants $permissions",
    async ({ permissions }) => {
      const name = crypto.randomUUID();
      const result = await inRequest(({ workspace: keys }) =>
        keys.createWorkspaceApiKey(workspace, { name, permissions }),
      );
      const account = await reader().findOneOrFail(
        WorkspaceMember,
        result.entity.memberId,
      );
      expect(account).toMatchObject({
        name,
        type: "SERVICE_ACCOUNT",
        status: "ACTIVE",
        user: null,
        permissions,
        roles: permissions.length ? [] : ["member"],
      });
      expect(account.workspace.id).toBe(workspace.id);
      expect(result.entity.memberId).not.toBe(member.id);
      expect(await reader().count(ApiKey, { owner: account })).toBe(1);
    },
  );

  it("uses provided owners without creating additional accounts", async () => {
    const account = await inRequest(
      async ({ system }) =>
        (
          await system.createSystemApiKey({
            name: crypto.randomUUID(),
            permissions: ["user:read"],
          })
        ).entity.systemAccountId,
    );
    const before = {
      accounts: await reader().count(SystemAccount),
      members: await reader().count(WorkspaceMember),
    };
    await inRequest(async ({ system, workspace: keys }) => {
      expect(
        (
          await system.createSystemApiKey({
            systemAccountId: account,
            name: "Existing",
            permissions: ["user:read"],
          })
        ).entity.systemAccountId,
      ).toBe(account);
      expect(
        (
          await keys.createWorkspaceApiKey(workspace, {
            member: member.id,
            name: "Personal",
          })
        ).entity.memberId,
      ).toBe(member.id);
    });
    expect(await reader().count(SystemAccount)).toBe(before.accounts);
    expect(await reader().count(WorkspaceMember)).toBe(before.members);
  });

  it.each(["system", "workspace"] as const)(
    "requires separate owner-creation permission for a new %s account",
    async (scope) => {
      let accountId: string | undefined;
      if (scope === "system") {
        accountId = await inRequest(
          async ({ system }) =>
            (
              await system.createSystemApiKey({
                name: crypto.randomUUID(),
                permissions: ["user:read"],
              })
            ).entity.systemAccountId,
        );
      }
      const options = withAuthTestFeatures({
        workspace: { enabled: true },
        buildAbility: ({ cannot }) => {
          cannot("write", scope === "system" ? SystemAccount : WorkspaceMember);
        },
      });
      await inRequest(async ({ system, workspace: keys }) => {
        if (scope === "system") {
          await system.createSystemApiKey({
            systemAccountId: accountId,
            name: "Existing owner allowed",
            permissions: ["user:read"],
          });
        } else {
          await keys.createWorkspaceApiKey(workspace, {
            member: member.id,
            name: "Existing owner allowed",
            permissions: ["workspace:read"],
          });
        }
      }, options);
      const name = crypto.randomUUID();
      await expect(
        inRequest(async ({ system, workspace: keys }) => {
          if (scope === "system") {
            await system.createSystemApiKey({
              name,
              permissions: ["user:read"],
            });
          } else {
            await keys.createWorkspaceApiKey(workspace, {
              name,
              permissions: ["workspace:read"],
            });
          }
        }, options),
      ).rejects.toThrow("not allowed");
      expect(
        scope === "system"
          ? await reader().count(SystemAccount, { name })
          : await reader().count(WorkspaceMember, { name }),
      ).toBe(0);
      expect(await reader().count(ApiKey, { name })).toBe(0);
    },
  );

  it.each(["system", "workspace"] as const)(
    "rolls back the new %s account when key field authorization fails",
    async (scope) => {
      const name = crypto.randomUUID();
      const options = withAuthTestFeatures({
        workspace: { enabled: true },
        buildAbility: ({ cannot }) => {
          cannot("write", scope === "system" ? SystemApiKey : WorkspaceApiKey, [
            "prefix",
          ]);
        },
      });
      await expect(
        inRequest(async ({ system, workspace: keys }) => {
          if (scope === "system") {
            await system.createSystemApiKey({
              name,
              prefix: "restricted_",
              permissions: ["user:read"],
            });
          } else {
            await keys.createWorkspaceApiKey(workspace, {
              name,
              prefix: "restricted_",
              permissions: ["workspace:read"],
            });
          }
        }, options),
      ).rejects.toThrow("not allowed");
      expect(
        scope === "system"
          ? await reader().count(SystemAccount, { name })
          : await reader().count(WorkspaceMember, { name }),
      ).toBe(0);
      expect(await reader().count(ApiKey, { name })).toBe(0);
    },
  );

  it.each(["system", "workspace"] as const)(
    "rolls back both %s records with an outer transaction",
    async (scope) => {
      const name = crypto.randomUUID();
      await expect(
        inRequest(async ({ system, workspace: keys, em }) => {
          em.clearSessionContext();
          await em.transactional(async () => {
            if (scope === "system") {
              await system.createSystemApiKey({
                name,
                permissions: ["user:read"],
              });
            } else {
              await keys.createWorkspaceApiKey(workspace, {
                name,
                permissions: ["workspace:read"],
              });
            }
            throw new Error("Rollback requested");
          });
        }),
      ).rejects.toThrow("Rollback requested");
      expect(
        scope === "system"
          ? await reader().count(SystemAccount, { name })
          : await reader().count(WorkspaceMember, { name }),
      ).toBe(0);
      expect(await reader().count(ApiKey, { name })).toBe(0);
    },
  );
});
