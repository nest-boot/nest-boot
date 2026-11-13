import assert from "node:assert/strict";

import { ref, Reference } from "@mikro-orm/core";
import {
  ConnectionManager,
  TotalCountRelation,
} from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import {
  apiKeyTest,
  createService,
  createTestApiKey,
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMember,
} from "../../../test/fixtures/api-key-service.fixture.js";
import { createTestAuthContext } from "../../../test/fixtures/auth-context.fixture.js";
import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { withIdentity } from "../../../test/fixtures/conditional-authorization.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { mockRlsContext } from "../../../test/mock-rls-context.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { API_KEY } from "../../core/constants/auth.constants.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import * as identityAccess from "../../core/utils/assert-current-identity.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { WorkspaceMemberType } from "../../workspace/enums/workspace-member-type.enum.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { WorkspaceApiKeyConnection } from "../connections/workspace-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
/* eslint-disable @typescript-eslint/unbound-method */
describe("API-key management", () => {
  describe("API-key management services", () => {
    apiKeyTest(
      "restricts a parent member connection without losing the workspace scope",
      async () => {
        const { service } = createService();
        const member = createTestWorkspaceMember();
        const find = vi
          .spyOn(ConnectionManager.prototype, "find")
          .mockResolvedValue({
            edges: [],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
            totalCount: 0,
            totalCountRelation: TotalCountRelation.EQ,
          });
        await service.getWorkspaceApiKeyConnection(
          createTestWorkspace(),
          { first: 10 },
          undefined,
          member,
        );
        expect(find).toHaveBeenCalledWith(
          WorkspaceApiKeyConnection,
          { first: 10 },
          expect.objectContaining({
            where: expect.objectContaining({
              ownerType: "workspace_member",
              owner: member,
            }),
            exclude: ["key"],
          }),
        );
        const foreign = createTestWorkspaceMember();
        foreign.workspace = ref(
          Workspace,
          Object.assign(createTestWorkspace(), { id: "other-workspace" }),
        );
        await expect(
          service.getWorkspaceApiKeyConnection(
            createTestWorkspace(),
            { first: 10 },
            undefined,
            foreign,
          ),
        ).rejects.toThrow("selected workspace");
        expect(find).toHaveBeenCalledOnce();
      },
    );

    for (const permissions of [[], ["workspace:read"]]) {
      apiKeyTest(
        `creates a service account when no owner is supplied (${String(permissions.length)} explicit grants)`,
        async () => {
          const { service } = createService();
          const current = RequestContext.get(WorkspaceMember);
          const created = await service.createWorkspaceApiKey(
            createTestWorkspace(),
            {
              name: "Automation",
              permissions,
            },
          );
          expect(created.entity.member?.id).not.toBe(current?.id);
          expect(created.entity.member).toMatchObject({
            name: "Automation",
            type: "SERVICE_ACCOUNT",
            user: null,
            roles: permissions.length ? [] : ["member"],
            permissions,
          });
        },
      );
    }
    apiKeyTest(
      "accepts a member entity without creating another service account",
      async () => {
        const { service } = createService();
        const member = createTestWorkspaceMember();
        const created = await service.createWorkspaceApiKey(
          createTestWorkspace(),
          {
            name: "Own key",
            member,
          },
        );
        expect(created.entity.member).toBe(member);
      },
    );
    for (const scope of (["user", "member"] as const).filter(
      (_row, index) => index === 1,
    )) {
      apiKeyTest(
        `prevents a restricted ${scope} key from creating or managing inherited keys`,
        async () => {
          const { service, em } = createService();
          const member = createTestWorkspaceMember();
          const user = createTestUser();
          const Key = scope === "user" ? UserApiKey : WorkspaceApiKey;
          const target = Object.assign(new Key(), {
            ...(scope === "user" ? { user } : { member }),
            permissions: [],
          });
          em.findOne.mockResolvedValue(target);
          stageIdentity({
            apiKey: Object.assign(new Key(), {
              ...(scope === "user" ? { user } : { member }),
              permissions: ["workspace:read"],
            }),
          });
          await expect(
            scope === "user"
              ? service.createUserApiKey(user, {
                  name: "Broader",
                  permissions: [],
                })
              : service.createWorkspaceApiKey(createTestWorkspace(), {
                  name: "Broader",
                  member,
                  permissions: [],
                }),
          ).rejects.toThrow("Unrestricted API keys");
          await expect(
            scope === "user"
              ? service.deleteUserApiKey(target.id)
              : service.deleteWorkspaceApiKey(target.id),
          ).rejects.toThrow("Unrestricted API keys");
          expect(em.flush).not.toHaveBeenCalled();
          expect(em.remove).not.toHaveBeenCalled();
        },
      );
    }
    for (const source of ["explicit", "default"]) {
      apiKeyTest(
        `rejects ${source} grants above the target service account even when the issuer has them`,
        async () => {
          const { service, em } = createService({
            apiKey: { workspace: { defaultPermissions: ["workspace:delete"] } },
          });
          const target: WorkspaceMember = Object.assign(
            createTestWorkspaceMember(),
            {
              id: "service-member",
              type: WorkspaceMemberType.SERVICE_ACCOUNT,
              user: null,
              roles: ["member"],
              permissions: [],
            },
          );
          em.findOne.mockResolvedValue(target);
          await expect(
            service.createWorkspaceApiKey(createTestWorkspace(), {
              name: "Deploy",
              member: target.id,
              ...(source === "explicit"
                ? { permissions: ["workspace:delete"] }
                : {}),
            }),
          ).rejects.toThrow(
            "WorkspaceMember API key permissions exceed owner permissions",
          );
          expect(em.persist).not.toHaveBeenCalled();
        },
      );
    }
    apiKeyTest(
      "issues only role and direct grants of the target member and enforces them on updates",
      async () => {
        const { service, em } = createService();
        const target: WorkspaceMember = Object.assign(
          createTestWorkspaceMember(),
          {
            id: "service-member",
            type: WorkspaceMemberType.SERVICE_ACCOUNT,
            user: null,
            roles: ["member"],
            permissions: ["workspace:update"],
          },
        );
        em.findOne.mockResolvedValue(target);
        const { entity } = await service.createWorkspaceApiKey(
          createTestWorkspace(),
          {
            name: "Deploy",
            member: target.id,
            permissions: ["workspace-member:read", "workspace:update"],
          },
        );
        const creation = em.create.mock.results.at(-1);
        assert(creation);
        em.findOne.mockResolvedValue(creation.value);
        em.flush.mockClear();
        await expect(
          service.updateWorkspaceApiKey(entity.id, {
            permissions: ["workspace:delete"],
          }),
        ).rejects.toThrow(
          "WorkspaceMember API key permissions exceed owner permissions",
        );
        expect(em.flush).not.toHaveBeenCalled();
        target.permissions = [];
        await expect(
          service.updateWorkspaceApiKey(entity.id, {
            expiresAt: new Date(Date.now() + 60000),
          }),
        ).rejects.toThrow(
          "WorkspaceMember API key permissions exceed owner permissions",
        );
        await expect(
          service.revokeWorkspaceApiKey(entity.id),
        ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
      },
    );
    for (const kind of [
      "self",
      "other-user",
      "service-account",
      "disabled",
      "foreign-workspace",
      "missing",
    ]) {
      apiKeyTest(
        `checks the member owner before issuing a key: ${kind}`,
        async () => {
          const { service, em } = createService();
          const target = Object.assign(createTestWorkspaceMember(), {
            id: "target-member",
          });
          if (kind === "other-user") {
            target.user = ref(
              User,
              Object.assign(createTestUser(), { id: "other-user" }),
            );
          }
          if (kind === "service-account") {
            target.type = WorkspaceMemberType.SERVICE_ACCOUNT;
            target.user = null;
          }
          if (kind === "disabled") {
            target.status = "DISABLED";
          }
          if (kind === "foreign-workspace") {
            target.workspace = ref(
              Workspace,
              Object.assign(createTestWorkspace(), { id: "foreign" }),
            );
          }
          em.findOne.mockResolvedValue(kind === "missing" ? null : target);
          const create = service.createWorkspaceApiKey(createTestWorkspace(), {
            name: "Key",
            member: target.id,
          });
          if (kind === "self" || kind === "service-account") {
            await expect(create).resolves.toMatchObject({
              entity: { member: target },
            });
            expect(em.create).toHaveBeenCalledWith(
              ApiKey,
              expect.objectContaining({ owner: target }),
            );
          } else {
            await expect(create).rejects.toThrow();
            expect(em.create).not.toHaveBeenCalled();
            expect(em.persist).not.toHaveBeenCalled();
          }
        },
      );
    }
    apiKeyTest("rejects keys without an owner before any write", async () => {
      const { service, em } = createService();
      for (const Entity of [UserApiKey, WorkspaceApiKey]) {
        const key = new Entity();
        em.findOne.mockResolvedValue(key);
        const update =
          Entity === UserApiKey
            ? service.updateUserApiKey(key.id, { name: "Denied" })
            : service.updateWorkspaceApiKey(key.id, { name: "Denied" });
        await expect(update).rejects.toThrow("API key owner is missing");
      }
      expect(em.flush).not.toHaveBeenCalled();
    });
    apiKeyTest(
      "keeps allowlists and default selections isolated between key scopes",
      async () => {
        const { service } = createService({
          apiKey: {
            user: { allowedPermissions: [], defaultPermissions: [] },
            workspace: {
              allowedPermissions: ["workspace:update"],
              defaultPermissions: ["workspace:update"],
            },
          },
        });
        expect(
          service
            .getUserApiKeyPermissions(createTestUser())
            .every((option) => !option.grantable && !option.default),
        ).toBe(true);
        expect(
          service.getWorkspaceApiKeyPermissions(createTestWorkspace()),
        ).toContainEqual({
          permission: "workspace:update",
          default: true,
          grantable: true,
        });
        await expect(
          service.createUserApiKey(createTestUser(), {
            name: "Denied",
            permissions: ["workspace:update"],
          }),
        ).rejects.toThrow("configured allowedPermissions");
        await expect(
          service.createWorkspaceApiKey(createTestWorkspace(), {
            member: RequestContext.get(WorkspaceMember),
            name: "Allowed",
          }),
        ).resolves.toMatchObject({
          entity: { permissions: ["workspace:update"] },
        });
      },
    );
    apiKeyTest(
      "reports configured defaults independently of grantability for both key scopes",
      () => {
        const { service } = createService({
          apiKey: {
            user: {
              defaultPermissions: [
                "workspace:update",
                "workspace-member:write",
              ],
            },
            workspace: {
              defaultPermissions: [
                "workspace:update",
                "workspace-member:write",
              ],
            },
          },
        });
        RequestContext.set(
          WorkspaceMember,
          Object.assign(createTestWorkspaceMember(), {
            roles: ["member"],
            permissions: ["workspace:update"],
          }),
        );
        RequestContext.set(
          API_KEY,
          Object.assign(new ApiKey(), {
            user: ref(User, createTestUser()),
            permissions: ["workspace:update"],
          }),
        );
        for (const options of [
          service.getUserApiKeyPermissions(createTestUser()),
          service.getWorkspaceApiKeyPermissions(createTestWorkspace()),
        ]) {
          expect(options).toContainEqual({
            permission: "workspace:update",
            grantable: true,
            default: true,
          });
          expect(options).toContainEqual({
            permission: "workspace-member:write",
            grantable: false,
            default: true,
          });
          expect(
            options
              .filter((option) => option.default)
              .map((option) => option.permission)
              .sort(),
          ).toEqual(["workspace-member:write", "workspace:update"]);
        }
      },
    );
    apiKeyTest("does not invent defaults when none are configured", () => {
      const { service } = createService();
      expect(service.getUserApiKeyPermissions(createTestUser())).toEqual(
        expect.arrayContaining([expect.objectContaining({ default: false })]),
      );
      expect(
        service
          .getWorkspaceApiKeyPermissions(createTestWorkspace())
          .every((option) => !option.default),
      ).toBe(true);
    });
    apiKeyTest(
      "reports key grantability using both caller ceilings and configuration",
      () => {
        const { service } = createService({
          apiKey: {
            user: {
              allowedPermissions: [
                "workspace-member:write",
                "user:read",
                "user:delete",
                "workspace-member:invite",
              ],
            },
            workspace: {
              allowedPermissions: [
                "workspace-member:write",
                "user:read",
                "user:delete",
                "workspace-member:invite",
              ],
            },
          },
        });
        const user = Object.assign(createTestUser(), {
          roles: ["user"],
          permissions: ["user:read"],
        });
        RequestContext.set(User, user);
        RequestContext.set(
          WorkspaceMember,
          Object.assign(createTestWorkspaceMember(), {
            roles: ["member"],
            permissions: ["workspace:update", "workspace-member:write"],
          }),
        );
        const workspaceOptions = service.getWorkspaceApiKeyPermissions(
          createTestWorkspace(),
        );
        expect(
          workspaceOptions
            .filter((option) => option.grantable)
            .map((option) => option.permission),
        ).toEqual(["workspace-member:write"]);
        expect(workspaceOptions).toContainEqual({
          permission: "workspace-member:invite",
          grantable: false,
          default: false,
        });
        const userOptions = service.getUserApiKeyPermissions(user);
        expect(userOptions).toContainEqual({
          permission: "user:read",
          grantable: true,
          default: false,
        });
        expect(userOptions).toContainEqual({
          permission: "user:delete",
          grantable: false,
          default: false,
        });
        expect(userOptions).toContainEqual({
          permission: "workspace:update",
          grantable: false,
          default: false,
        });
        expect(userOptions).toContainEqual({
          permission: "workspace-member:invite",
          grantable: true,
          default: false,
        });
        stageIdentity({
          apiKey: Object.assign(new ApiKey(), {
            user: ref(User, user),
            permissions: ["user:read"],
          }),
        });
        expect(
          service
            .getUserApiKeyPermissions(user)
            .filter((option) => option.grantable)
            .map((option) => option.permission),
        ).toEqual(["user:read"]);
      },
    );
    apiKeyTest(
      "does not revoke a user credential when a workspace key has the same ID",
      async () => {
        const { service, em } = createService();
        const user = createTestUser();
        const active = Object.assign(new ApiKey(), {
          id: "same-id",
          user: ref(User, user),
          permissions: ["workspace:update"],
        });
        const target = Object.assign(createTestApiKey(), {
          id: active.id,
          permissions: ["workspace:update"],
        });
        const ability = new AuthAbility();
        RequestContext.set(User, user);
        RequestContext.set(API_KEY, active);
        RequestContext.set(AuthAbility, ability);
        em.findOne.mockResolvedValue(target);
        em.isInTransaction.mockReturnValue(true);
        mockRlsContext(em);
        await service.revokeWorkspaceApiKey(target.id);
        expect(target.lastUsedAt).toBeNull();
        expect(RequestContext.get(API_KEY)).toBe(active);
        expect(RequestContext.get(User)).toBe(user);
        expect(RequestContext.get(AuthAbility)).toBe(ability);
        expect(em.setSessionContext).not.toHaveBeenCalled();
      },
    );
    for (const scope of (["user", "workspace"] as const).filter(
      (_row, index) => index === 1,
    )) {
      apiKeyTest(
        `checks conditional read restrictions on the loaded ${scope} key`,
        async () => {
          const options: AuthModuleOptions = {
            workspace: { enabled: true },
            buildAbility: ({ cannot }) => {
              cannot("read", UserApiKey, { revokedAt: { $ne: null } });
              cannot("read", WorkspaceApiKey, { revokedAt: { $ne: null } });
            },
          };
          const { service, em, authorization } = createService(options);
          vi.mocked(authorization.authorize).mockRestore();
          const user = Object.assign(createTestUser(), { roles: ["admin"] });
          stageIdentity({ user });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          const key = Object.assign(new ApiKey(), {
            id: "conditional-key",
            key: "already-hydrated-key-hash",
            permissions: [],
            owner:
              scope === "user"
                ? ref(User, user)
                : ref(WorkspaceMember, createTestWorkspaceMember()),
          });
          const read = () =>
            scope === "user"
              ? service.getUserApiKey(key.id, user)
              : service.getWorkspaceApiKey(key.id, createTestWorkspace());
          em.findOne.mockResolvedValue(key);
          expect(await read()).toEqual(toApiKeyView(key));
          expect(await read()).not.toHaveProperty("key");
          expect(key.key).toBe("already-hydrated-key-hash");
          key.revokedAt = new Date();
          await expect(read()).rejects.toThrow(ForbiddenException);
          em.findOne.mockResolvedValue(null);
          await expect(read()).resolves.toBeNull();
        },
      );
      apiKeyTest(
        `rejects a ${scope} connection page containing a conditionally denied key without changing pagination`,
        async () => {
          const options: AuthModuleOptions = {
            workspace: { enabled: true },
            buildAbility: ({ cannot }) => {
              cannot("read", UserApiKey, { revokedAt: { $ne: null } });
              cannot("read", WorkspaceApiKey, { revokedAt: { $ne: null } });
            },
          };
          const { service, authorization } = createService(options);
          vi.mocked(authorization.authorize).mockRestore();
          const user = Object.assign(createTestUser(), { roles: ["admin"] });
          stageIdentity({ user });
          createTestAuthContext(
            undefined,
            withAuthTestFeatures(options),
          ).getAbility();
          const key = Object.assign(new ApiKey(), {
            owner:
              scope === "user"
                ? ref(User, user)
                : ref(WorkspaceMember, createTestWorkspaceMember()),
          });
          const result = {
            edges: [{ cursor: "cursor", node: key }],
            totalCount: 2,
            pageInfo: { hasNextPage: true, endCursor: "cursor" },
          };
          vi.spyOn(ConnectionManager.prototype, "find").mockResolvedValue(
            result as never,
          );
          const read = () =>
            scope === "user"
              ? service.getUserApiKeyConnection(user, { first: 1 })
              : service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
                  first: 1,
                });
          await expect(read()).resolves.toEqual({
            ...result,
            edges: result.edges.map((edge) => ({
              ...edge,
              node: toApiKeyView(edge.node),
            })),
          });
          key.revokedAt = new Date();
          await expect(read()).rejects.toThrow(ForbiddenException);
          expect(result.edges).toHaveLength(1);
          expect(result.totalCount).toBe(2);
          expect(result.pageInfo).toEqual({
            hasNextPage: true,
            endCursor: "cursor",
          });
        },
      );
      for (const reason of ["catalog", "owner"] as const) {
        apiKeyTest(
          `allows revoking a ${scope} key with stale ${reason} grants without weakening its grants`,
          async () => {
            const options: AuthModuleOptions =
              reason === "catalog"
                ? {
                    workspace: { enabled: true },
                    apiKey: {
                      user: { allowedPermissions: ["user-api-key:write"] },
                      workspace: {
                        allowedPermissions: ["workspace-api-key:write"],
                      },
                    },
                  }
                : { workspace: { enabled: true } };
            const { service, em, authorization } = createService(options);
            vi.mocked(authorization.authorize).mockRestore();
            const user = Object.assign(createTestUser(), {
              roles: [reason === "owner" ? "user" : "admin"],
              permissions: ["user-api-key:write"],
            });
            const member = Object.assign(createTestWorkspaceMember(), {
              roles: [reason === "owner" ? "member" : "owner"],
              permissions: ["workspace-api-key:write"],
            });
            stageIdentity({ user, member });
            createTestAuthContext(
              undefined,
              withAuthTestFeatures(options),
            ).getAbility();
            const permissions = [
              scope === "user" ? "user:read" : "workspace:delete",
            ];
            const key = Object.assign(new ApiKey(), {
              id: "stale-key",
              permissions,
              owner:
                scope === "user"
                  ? ref(User, user)
                  : ref(WorkspaceMember, createTestWorkspaceMember()),
            });
            em.findOne.mockResolvedValue(key);
            const update =
              scope === "user"
                ? service.updateUserApiKey
                : service.updateWorkspaceApiKey;
            const revoke =
              scope === "user"
                ? service.revokeUserApiKey
                : service.revokeWorkspaceApiKey;
            const revoked = await revoke(key.id);
            expect(revoked).toMatchObject({
              id: key.id,
              permissions,
              revokedAt: expect.any(Date),
            });
            expect(key.revokedAt).toBeNull();
            em.findOne.mockResolvedValue(
              Object.assign(new ApiKey(), key, {
                revokedAt: revoked.revokedAt,
                updatedAt: revoked.updatedAt,
              }),
            );
            expect(key.permissions).toEqual(permissions);
            expect(em.nativeUpdate).toHaveBeenCalledOnce();
            expect(em.flush).not.toHaveBeenCalled();
            await expect(
              update(key.id, { name: "Audit rename" }),
            ).resolves.toMatchObject({ name: "Audit rename" });
            await expect(
              update(key.id, { expiresAt: new Date(Date.now() + 60000) }),
            ).rejects.toThrow();
            await expect(update(key.id, { permissions })).rejects.toThrow();
            expect(revoked.revokedAt).toBeInstanceOf(Date);
            expect(em.nativeUpdate).toHaveBeenCalledTimes(2);
            expect(em.flush).not.toHaveBeenCalled();
          },
        );
      }
      apiKeyTest(
        `rejects missing ${scope} keys and invalid expiration changes without persistence`,
        async () => {
          const { em, service } = createService();
          const user = createTestUser();
          RequestContext.set(User, user);
          const key =
            scope === "user"
              ? Object.assign(new ApiKey(), {
                  id: "key",
                  user: ref(User, user),
                  name: "Original",
                  permissions: [],
                  expiresAt: new Date(Date.now() + 60000),
                })
              : createTestApiKey();
          const update = (input: { expiresAt?: Date | null; name?: string }) =>
            scope === "user"
              ? service.updateUserApiKey(key.id, input)
              : service.updateWorkspaceApiKey(key.id, input);
          const remove = () =>
            scope === "user"
              ? service.deleteUserApiKey(key.id)
              : service.deleteWorkspaceApiKey(key.id);
          em.findOne.mockResolvedValue(null);
          await expect(update({ name: "Missing" })).rejects.toThrow(
            "API key not found",
          );
          await expect(remove()).rejects.toThrow("API key not found");
          em.findOne.mockResolvedValue(key);
          const original = { name: key.name, expiresAt: key.expiresAt };
          await expect(
            update({ name: "Must not change", expiresAt: new Date(0) }),
          ).rejects.toThrow("expiration must be in the future");
          await expect(
            scope === "user"
              ? service.createUserApiKey(user, {
                  name: "Expired",
                  expiresAt: new Date(0),
                })
              : service.createWorkspaceApiKey(createTestWorkspace(), {
                  member: RequestContext.get(WorkspaceMember),
                  name: "Expired",
                  expiresAt: new Date(0),
                }),
          ).rejects.toThrow("expiration must be in the future");
          expect(key).toMatchObject(original);
          expect(em.flush).not.toHaveBeenCalled();
          expect(em.create).not.toHaveBeenCalled();
          expect(await update({ expiresAt: null })).toMatchObject({
            expiresAt: null,
          });
          expect(key).toMatchObject(original);
          expect(em.nativeUpdate).toHaveBeenCalledOnce();
          expect(em.flush).not.toHaveBeenCalled();
        },
      );
      for (const operation of ["permissions", "revoke", "delete"] as const) {
        apiKeyTest(
          `publishes ${scope} credential ${operation} changes only after commit`,
          async () => {
            const { service, em } = createService();
            const user = createTestUser();
            const key = Object.assign(new ApiKey(), {
              id: "active-key",
              permissions: ["workspace:update", "workspace:read"],
              lastUsedAt: new Date(0),
              owner:
                scope === "user"
                  ? ref(User, user)
                  : ref(WorkspaceMember, createTestWorkspaceMember()),
            });
            if (scope === "user") {
              RequestContext.set(User, user);
            }
            RequestContext.set(API_KEY, key);
            const ability = new AuthAbility([
              { action: "update", subject: Workspace },
            ]);
            RequestContext.set(AuthAbility, ability);
            em.findOne.mockResolvedValue(key);
            mockRlsContext(em).variables = {
              "app.user.id": user.id,
              "app.workspace.id": createTestWorkspace().id,
              "app.system_account.id": "",
              "app.member.id": createTestWorkspaceMember().id,
            };
            const update =
              scope === "user"
                ? service.updateUserApiKey
                : service.updateWorkspaceApiKey;
            const remove =
              scope === "user"
                ? service.deleteUserApiKey
                : service.deleteWorkspaceApiKey;
            const invoke = () =>
              operation === "delete"
                ? remove(key.id)
                : operation === "revoke"
                  ? (scope === "user"
                      ? service.revokeUserApiKey
                      : service.revokeWorkspaceApiKey)(key.id)
                  : update(key.id, { permissions: ["workspace:read"] });
            const persistence =
              operation === "delete" ? em.flush : em.nativeUpdate;
            persistence.mockRejectedValueOnce(new Error("Commit failed"));
            await expect(invoke()).rejects.toThrow("Commit failed");
            expect(RequestContext.get(API_KEY)).toMatchObject(
              toApiKeyView(key),
            );
            expect(key.revokedAt).toBeNull();
            expect(key.lastUsedAt).toEqual(new Date(0));
            expect(key.permissions).toEqual([
              "workspace:update",
              "workspace:read",
            ]);
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            expect(em.setSessionContext).not.toHaveBeenCalled();
            const beforeCommit = () => {
              expect(RequestContext.get(API_KEY)).toMatchObject(
                toApiKeyView(key),
              );
              expect(em.setSessionContext).not.toHaveBeenCalled();
            };
            if (operation === "delete") {
              em.flush.mockImplementationOnce(() => {
                beforeCommit();
                return Promise.resolve();
              });
            } else {
              em.nativeUpdate.mockImplementationOnce(() => {
                beforeCommit();
                return Promise.resolve(1);
              });
            }
            const changed = await invoke();
            if (operation === "revoke") {
              expect(changed.lastUsedAt).toBeInstanceOf(Date);
              expect(key.lastUsedAt).toEqual(new Date(0));
            }
            expect(
              RequestContext.get(AuthAbility)?.can("update", Workspace),
            ).toBe(false);
            if (operation === "permissions") {
              expect(RequestContext.get(API_KEY)).toMatchObject(changed);
              expect(em.setSessionContext).not.toHaveBeenCalled();
            } else {
              expect(RequestContext.get(API_KEY)).toBeNull();
              expect(RequestContext.get(User)).toBeNull();
              expect(RequestContext.get(WorkspaceMember)).toBeNull();
              expect(RequestContext.get(Workspace)).toBeNull();
              expect(em.setSessionContext).toHaveBeenCalledWith({
                role: "anonymous",
                variables: {
                  "app.user.id": "",
                  "app.workspace.id": "",
                  "app.system_account.id": "",
                  "app.member.id": "",
                },
              });
            }
          },
        );
      }
      for (const action of ["update", "delete"] as const) {
        apiKeyTest(
          `checks ${scope} ${action} ability against the loaded API key`,
          async () => {
            const { service, em, authorization } = createService();
            const key = Object.assign(new ApiKey(), {
              user: scope === "user" ? ref(User, createTestUser()) : null,
              member:
                scope === "workspace"
                  ? ref(WorkspaceMember, createTestWorkspaceMember())
                  : null,
            });
            em.findOne.mockResolvedValue(key);
            const assertion =
              scope === "user"
                ? authorization.authorize
                : authorization.authorize;
            vi.mocked(assertion).mockImplementation((_action, subject) => {
              if (subject === key) {
                throw new ForbiddenException();
              }
            });
            const operation =
              scope === "user"
                ? action === "update"
                  ? () => service.updateUserApiKey(key.id, { name: "Denied" })
                  : () => service.deleteUserApiKey(key.id)
                : action === "update"
                  ? () =>
                      service.updateWorkspaceApiKey(key.id, { name: "Denied" })
                  : () => service.deleteWorkspaceApiKey(key.id);
            await expect(operation()).rejects.toBeInstanceOf(
              ForbiddenException,
            );
            expect(assertion).toHaveBeenCalledWith(
              "write",
              scope === "user" ? UserApiKey : WorkspaceApiKey,
            );
            expect(assertion).toHaveBeenLastCalledWith("write", key);
            expect(key.name).not.toBe("Denied");
            expect(em.flush).not.toHaveBeenCalled();
            expect(em.remove).not.toHaveBeenCalled();
          },
        );
      }
    }
    apiKeyTest(
      "keeps update/delete in the request RLS context and excludes the credential hash",
      async () => {
        const { service, em } = createService();
        const context = mockRlsContext(em);
        const key = createTestApiKey();
        em.findOne.mockResolvedValue(key);
        await service.updateWorkspaceApiKey(key.id, { name: "Scoped update" });
        await service.deleteWorkspaceApiKey(key.id);
        expect(em.findOne).toHaveBeenCalledWith(
          ApiKey,
          { id: key.id, ownerType: "workspace_member" },
          {
            populate: ["owner"],
            exclude: ["key"],
            refresh: true,
          },
        );
        expect(em.fork).not.toHaveBeenCalled();
        expect(em.getSessionContext()).toEqual(context);
      },
    );
    apiKeyTest(
      "rejects foreign owners even when a misconfigured database returns their keys",
      async () => {
        const { service, em, authorization } = createService();
        vi.mocked(authorization.assertCurrentUser).mockRestore();
        RequestContext.set(User, createTestUser());
        const foreignUser = Object.assign(createTestUser(), {
          id: "foreign-user",
        });
        const foreignWorkspace = Object.assign(createTestWorkspace(), {
          id: "foreign-workspace",
        });
        for (const owner of [foreignUser, foreignWorkspace]) {
          const key = Object.assign(
            owner instanceof User ? new ApiKey() : new ApiKey(),
            {
              user: owner instanceof User ? ref(User, owner) : null,
              member:
                owner instanceof Workspace
                  ? ref(
                      WorkspaceMember,
                      Object.assign(createTestWorkspaceMember(), {
                        workspace: ref(Workspace, owner),
                      }),
                    )
                  : null,
            },
          );
          em.findOne.mockResolvedValue(key);
          const update =
            owner instanceof User
              ? () => service.updateUserApiKey(key.id, { name: "Denied" })
              : () => service.updateWorkspaceApiKey(key.id, { name: "Denied" });
          const remove =
            owner instanceof User
              ? () => service.deleteUserApiKey(key.id)
              : () => service.deleteWorkspaceApiKey(key.id);
          await expect(update()).rejects.toBeInstanceOf(ForbiddenException);
          await expect(remove()).rejects.toBeInstanceOf(ForbiddenException);
        }
        expect(em.flush).not.toHaveBeenCalled();
        expect(em.remove).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "paginates user and member keys in the authorized ORM context",
      async () => {
        const { service, em, authorization } = createService();
        vi.spyOn(identityAccess, "assertCurrentWorkspace");
        const user = createTestUser();
        const workspace = createTestWorkspace();
        const args = { first: 10, after: "cursor" };
        const result = {
          edges: [] as {
            cursor: string;
            node: object;
          }[],
          pageInfo: {},
        };
        const find = vi
          .spyOn(ConnectionManager.prototype, "find")
          .mockResolvedValue(result as never);
        const session = mockRlsContext(em);
        await expect(
          service.getUserApiKeyConnection(user, args),
        ).resolves.toEqual({
          ...result,
          edges: result.edges.map((edge) => ({
            ...edge,
            node: omitCredentials(edge.node, [
              "key",
              "token",
              "password",
              "accessToken",
              "refreshToken",
              "idToken",
            ]),
          })),
        });
        expect(find).toHaveBeenLastCalledWith(UserApiKeyConnection, args, {
          where: { owner: user, ownerType: "user" },
          exclude: ["key"],
        });
        await expect(
          service.getWorkspaceApiKeyConnection(workspace, args),
        ).resolves.toEqual({
          ...result,
          edges: result.edges.map((edge) => ({
            ...edge,
            node: omitCredentials(edge.node, [
              "key",
              "token",
              "password",
              "accessToken",
              "refreshToken",
              "idToken",
            ]),
          })),
        });
        expect(find).toHaveBeenLastCalledWith(WorkspaceApiKeyConnection, args, {
          where: expect.objectContaining({ ownerType: "workspace_member" }),
          populate: ["owner"],
          exclude: ["key"],
        });
        expect(find.mock.instances[0]).toHaveProperty("em", em);
        expect(authorization.assertCurrentUser).toHaveBeenCalledWith(user);
        expect(authorization.authorize).toHaveBeenCalledWith(
          "read",
          UserApiKey,
        );
        expect(authorization.assertCurrentWorkspace).toHaveBeenCalledWith(
          workspace,
        );
        expect(authorization.authorize).toHaveBeenCalledWith(
          "read",
          WorkspaceApiKey,
        );
        expect(em.fork).not.toHaveBeenCalled();
        expect(em.getSessionContext()).toEqual(session);
      },
    );
    apiKeyTest(
      "rejects API-key pagination before creating a connection query",
      async () => {
        const { service, authorization } = createService();
        const find = vi.spyOn(ConnectionManager.prototype, "find");
        vi.mocked(authorization.authorize).mockImplementation(() => {
          throw new ForbiddenException();
        });
        vi.mocked(authorization.authorize).mockImplementation(() => {
          throw new ForbiddenException();
        });
        await expect(
          service.getUserApiKeyConnection(createTestUser(), { first: 10 }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
            first: 10,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(find).not.toHaveBeenCalled();
      },
    );
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });
    apiKeyTest(
      "creates a prefixed key and stores only its SHA-256 hash",
      async () => {
        vi.stubEnv("API_KEY_PREFIX", "nb-");
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const member = RequestContext.get(WorkspaceMember);
        if (!member) {
          throw new Error("Missing test member");
        }
        member.workspace = workspace as never;
        const result = await service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Deploy key",
        });
        expect(result.apiKey).toMatch(/^nb-[A-Za-z0-9_-]{64}$/);
        expect(em.create).toHaveBeenCalledWith(
          ApiKey,
          expect.objectContaining({
            revokedAt: null,
            key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
            name: "Deploy key",
            permissions: [],
            prefix: "nb-",
            start: result.apiKey.slice(0, 8),
            owner: member,
          }),
        );
        expect(JSON.stringify(result.entity)).not.toContain(result.apiKey);
        expect(em.flush).toHaveBeenCalledTimes(1);
      },
    );
    apiKeyTest(
      "allows both key scopes to carry member invitation management",
      async () => {
        const { em, service } = createService();
        await service.createWorkspaceApiKey(createTestWorkspace(), {
          member: RequestContext.get(WorkspaceMember),
          name: "WorkspaceInvitation manager",
          permissions: ["workspace-member:invite"],
        });
        expect(em.create).toHaveBeenCalledWith(
          ApiKey,
          expect.objectContaining({ permissions: ["workspace-member:invite"] }),
        );
        const existing = createTestApiKey();
        em.findOne.mockResolvedValue(existing);
        const updated = await service.updateWorkspaceApiKey(existing.id, {
          permissions: ["workspace-member:invite"],
        });
        expect(updated.permissions).toEqual(["workspace-member:invite"]);
        expect(existing.permissions).toEqual([]);
        await service.createUserApiKey(createTestUser(), {
          name: "Human inviter",
          permissions: ["workspace-member:invite"],
        });
        expect(em.create).toHaveBeenCalledWith(
          ApiKey,
          expect.objectContaining({ permissions: ["workspace-member:invite"] }),
        );
      },
    );
    apiKeyTest("stores workspace permissions as string values", async () => {
      const { em, service } = createService();
      const workspace = createTestWorkspace();
      const permissions = ["workspace:update"];
      await service.createWorkspaceApiKey(workspace, {
        member: RequestContext.get(WorkspaceMember),
        name: "Deploy key",
        permissions,
      });
      expect(em.create).toHaveBeenCalledWith(
        ApiKey,
        expect.objectContaining({ permissions }),
      );
    });
    apiKeyTest(
      "uses independent scope defaults only when creation omits permissions",
      async () => {
        const { em, service } = createService({
          apiKey: {
            user: {
              defaultPermissions: ["user:read"],
            },
            workspace: {
              defaultPermissions: ["workspace:update"],
            },
          },
        });
        const workspace = createTestWorkspace();
        await service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Default permissions",
        });
        await service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Explicitly empty permissions",
          permissions: null,
        });
        await service.createUserApiKey(
          Object.assign(createTestUser(), { permissions: ["user:read"] }),
          {
            name: "Independent defaults for user keys",
          },
        );
        expect(em.create).toHaveBeenNthCalledWith(
          1,
          ApiKey,
          expect.objectContaining({ permissions: ["workspace:update"] }),
        );
        expect(em.create).toHaveBeenNthCalledWith(
          2,
          ApiKey,
          expect.objectContaining({ permissions: [] }),
        );
        expect(em.create).toHaveBeenNthCalledWith(
          3,
          ApiKey,
          expect.objectContaining({ permissions: ["user:read"] }),
        );
      },
    );
    apiKeyTest(
      "preserves mixed-case grants when creating and updating either key type",
      async () => {
        const { em, service } = createService({
          user: {
            permissions: ["User:READ", "user:read"],
            roles: { user: [] },
          },
          workspace: {
            enabled: true,
            permissions: ["Workspace:UPDATE", "workspace:update"],
            roles: { owner: ["Workspace:UPDATE", "workspace:update"] },
          },
          apiKey: {
            user: {
              allowedPermissions: [
                "User:READ",
                "user:read",
                "Workspace:UPDATE",
                "workspace:update",
              ],
            },
            workspace: {
              allowedPermissions: [
                "User:READ",
                "user:read",
                "Workspace:UPDATE",
                "workspace:update",
              ],
            },
          },
        });
        const user = Object.assign(createTestUser(), {
          permissions: ["User:READ"],
        });
        const personal = await service.createUserApiKey(user, {
          name: "Personal key",
          permissions: ["User:READ"],
        });
        expect(personal.entity.permissions).toEqual(["User:READ"]);
        em.findOne.mockResolvedValue(
          em.create.mock.results.find(
            (result) => result.value.id === personal.entity.id,
          )?.value,
        );
        await service.updateUserApiKey(personal.entity.id, {
          permissions: ["User:READ"],
        });
        await expect(
          service.updateUserApiKey(personal.entity.id, {
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "User API key permissions exceed owner permissions: user:read",
        );
        const workspace = await service.createWorkspaceApiKey(
          createTestWorkspace(),
          {
            member: RequestContext.get(WorkspaceMember),
            name: "Workspace key",
            permissions: ["Workspace:UPDATE"],
          },
        );
        expect(workspace.entity.permissions).toEqual(["Workspace:UPDATE"]);
        em.findOne.mockResolvedValue(
          em.create.mock.results.find(
            (result) => result.value.id === workspace.entity.id,
          )?.value,
        );
        const updated = await service.updateWorkspaceApiKey(
          workspace.entity.id,
          { permissions: ["workspace:update"] },
        );
        expect(updated.permissions).toEqual(["workspace:update"]);
        expect(workspace.entity.permissions).toEqual(["Workspace:UPDATE"]);
        await expect(
          service.updateWorkspaceApiKey(workspace.entity.id, {
            permissions: ["Workspace:update"],
          }),
        ).rejects.toThrow("contains unknown permissions: Workspace:update");
      },
    );
    apiKeyTest(
      "enforces the configured API-key permission allowlist",
      async () => {
        const { em, service } = createService({
          apiKey: {
            user: {
              allowedPermissions: ["workspace:update"],
            },
            workspace: {
              allowedPermissions: ["workspace:update"],
            },
          },
        });
        const workspace = createTestWorkspace();
        const user = Object.assign(createTestUser(), { roles: ["admin"] });
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Allowed workspace key",
            permissions: ["workspace:update"],
          }),
        ).resolves.toBeDefined();
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Disallowed workspace key",
            permissions: ["workspace:delete"],
          }),
        ).rejects.toThrow(
          "API key permissions exceed configured allowedPermissions: workspace:delete",
        );
        await expect(
          service.createUserApiKey(user, {
            name: "Disallowed user key",
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "API key permissions exceed configured allowedPermissions: user:read",
        );
        expect(em.create).toHaveBeenCalledOnce();
      },
    );
    apiKeyTest(
      "validates API-key permissions according to the owner type",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Invalid workspace key",
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "WorkspaceMember API key contains unknown permissions: user:read",
        );
        await expect(
          service.createUserApiKey(createTestUser(), {
            name: "Invalid user key",
            permissions: ["unknown:execute"],
          }),
        ).rejects.toThrow(
          "User API key contains unknown permissions: unknown:execute",
        );
        expect(em.create).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "extends configured permission catalogs without removing the defaults",
      async () => {
        const { em, service } = createService({
          user: {
            permissions: ["project:read"],
            roles: { user: [], admin: ["project:read"] },
          },
          workspace: {
            enabled: true,
            permissions: ["deployment:run"],
            roles: { member: [], owner: ["deployment:run"] },
          },
        });
        const workspace = createTestWorkspace();
        const user = createTestUser();
        user.permissions = ["project:read"];
        await service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Deployment key",
          permissions: ["deployment:run"],
        });
        await service.createUserApiKey(user, {
          name: "Project deployment key",
          permissions: ["project:read", "deployment:run"],
        });
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Built-in permission key",
            permissions: ["workspace:update"],
          }),
        ).resolves.toBeDefined();
        expect(em.create).toHaveBeenCalledTimes(3);
      },
    );
    apiKeyTest(
      "prevents member keys from exceeding their owning member's permissions",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const member = RequestContext.get(WorkspaceMember);
        if (!member) {
          throw new Error("Missing test member");
        }
        member.roles = ["admin"];
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Escalated workspace key",
            permissions: ["workspace:delete"],
          }),
        ).rejects.toThrow(
          "WorkspaceMember API key permissions exceed owner permissions: workspace:delete",
        );
        member.permissions = ["workspace:delete"];
        stageIdentity({ member });
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Direct permission key",
            permissions: ["workspace:delete"],
          }),
        ).resolves.toBeDefined();
        expect(em.create).toHaveBeenCalledOnce();
      },
    );
    apiKeyTest(
      "validates updated API-key permissions according to the owner type",
      async () => {
        const { em, service } = createService();
        const memberKey = createTestApiKey();
        em.findOne.mockResolvedValue(memberKey);
        await expect(
          service.updateWorkspaceApiKey(memberKey.id, {
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "WorkspaceMember API key contains unknown permissions: user:read",
        );
        const user = createTestUser();
        const userKey = Object.assign(new ApiKey(), {
          user: ref(User, user),
        });
        em.findOne.mockResolvedValue(userKey);
        expect(
          await service.updateUserApiKey(userKey.id, {
            permissions: ["workspace:update"],
          }),
        ).toMatchObject({ id: userKey.id, permissions: ["workspace:update"] });
        expect(userKey.permissions).toEqual([]);
      },
    );
    apiKeyTest(
      "enforces owner permission ceilings when API-key permissions are updated",
      async () => {
        const { em, service } = createService();
        const member = RequestContext.get(WorkspaceMember);
        if (!member) {
          throw new Error("Missing test member");
        }
        member.roles = ["admin"];
        const memberKey = createTestApiKey();
        em.findOne.mockResolvedValue(memberKey);
        await expect(
          service.updateWorkspaceApiKey(memberKey.id, {
            permissions: ["workspace:delete"],
          }),
        ).rejects.toThrow(
          "Workspace permissions exceed issuer permissions: workspace:delete",
        );
        expect(memberKey.permissions).toEqual([]);
        const user = createTestUser();
        const userKey = Object.assign(new ApiKey(), {
          user: ref(User, user),
        });
        em.findOne.mockResolvedValue(userKey);
        await expect(
          service.updateUserApiKey(userKey.id, {
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "User API key permissions exceed owner permissions: user:read",
        );
        expect(userKey.permissions).toEqual([]);
        expect(em.flush).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "preserves omitted permissions and clears explicit null on update",
      async () => {
        const { em, service } = createService();
        const apiKey = Object.assign(createTestApiKey(), {
          permissions: ["workspace:update"],
        });
        em.findOne.mockResolvedValue(apiKey);
        await service.updateWorkspaceApiKey(apiKey.id, {
          name: "Renamed",
        });
        expect(apiKey.permissions).toEqual(["workspace:update"]);
        const cleared = await service.updateWorkspaceApiKey(apiKey.id, {
          permissions: null,
        });
        expect(cleared.permissions).toEqual([]);
        expect(apiKey.permissions).toEqual(["workspace:update"]);
      },
    );
    apiKeyTest(
      "prevents user API keys from escalating delegated member keys",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const targetKey = Object.assign(createTestApiKey(), {
          permissions: ["workspace:update"],
        });
        em.findOne.mockResolvedValue(targetKey);
        const authenticatingKey = Object.assign(new ApiKey(), {
          workspace: null,
          user: ref(User, createTestUser()),
          permissions: ["workspace:update"],
        });
        await RequestContext.child(async () => {
          RequestContext.set(API_KEY, authenticatingKey);
          await expect(
            service.createWorkspaceApiKey(workspace, {
              member: RequestContext.get(WorkspaceMember),
              name: "Escalated workspace key",
              permissions: ["workspace:delete"],
            }),
          ).rejects.toThrow(
            "Workspace permissions exceed issuer permissions: workspace:delete",
          );
          await expect(
            service.updateWorkspaceApiKey(targetKey.id, {
              permissions: ["workspace:delete"],
            }),
          ).rejects.toThrow(
            "Workspace permissions exceed issuer permissions: workspace:delete",
          );
          targetKey.permissions = ["workspace:delete"];
          await expect(
            service.revokeWorkspaceApiKey(targetKey.id),
          ).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: workspace:delete",
          );
          await expect(
            service.updateWorkspaceApiKey(targetKey.id, {
              expiresAt: new Date(Date.now() + 60000),
            }),
          ).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: workspace:delete",
          );
          targetKey.permissions = [];
          await expect(
            service.createWorkspaceApiKey(workspace, {
              member: RequestContext.get(WorkspaceMember),
              name: "Allowed workspace key",
              permissions: ["workspace:update"],
            }),
          ).resolves.toBeDefined();
        });
      },
    );
    apiKeyTest(
      "allows service account members to manage keys within their permissions",
      async () => {
        const { em, service, authorization } = createService();
        const workspace = createTestWorkspace();
        const target = Object.assign(createTestApiKey(), {
          permissions: ["workspace:update"],
        });
        em.findOne.mockResolvedValue(target);
        const account = Object.assign(createTestWorkspaceMember(), {
          type: WorkspaceMemberType.SERVICE_ACCOUNT,
          user: null,
        });
        RequestContext.set(User, null);
        RequestContext.set(WorkspaceMember, account);
        RequestContext.set(
          API_KEY,
          Object.assign(createTestApiKey(), {
            member: ref(WorkspaceMember, account),
            permissions: ["workspace:update"],
          }),
        );
        const find = vi
          .spyOn(ConnectionManager.prototype, "find")
          .mockResolvedValue({ edges: [], pageInfo: {} } as never);
        await service.getWorkspaceApiKeyConnection(workspace, { first: 10 });
        expect(find).toHaveBeenCalledWith(
          WorkspaceApiKeyConnection,
          { first: 10 },
          {
            where: expect.objectContaining({
              ownerType: "workspace_member",
              permissions: { $contained: ["workspace:update"], $ne: [] },
            }),
            populate: ["owner"],
            exclude: ["key"],
          },
        );
        expect(await service.getWorkspaceApiKey(target.id, workspace)).toEqual(
          toApiKeyView(target),
        );
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Bounded",
            permissions: ["workspace:update"],
          }),
        ).resolves.toBeDefined();
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Excessive",
            permissions: ["workspace:delete"],
          }),
        ).rejects.toThrow(ForbiddenException);
        expect(
          await service.updateWorkspaceApiKey(target.id, {
            permissions: ["workspace:update"],
          }),
        ).toMatchObject({
          id: target.id,
          permissions: target.permissions,
          updatedAt: expect.any(Date),
        });
        expect(await service.deleteWorkspaceApiKey(target.id)).toEqual(
          toApiKeyView(target),
        );
        expect(authorization.assertCurrentWorkspaceMember).toHaveBeenCalledWith(
          account,
        );
      },
    );
    apiKeyTest(
      "denies member-key access outside the selected workspace or permission ceiling",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const currentKey = Object.assign(createTestApiKey(), {
          permissions: ["workspace:read"],
        });
        RequestContext.set(API_KEY, currentKey);
        const target = Object.assign(createTestApiKey(), {
          permissions: ["workspace:delete"],
        });
        em.findOne.mockResolvedValue(target);
        await expect(
          service.getWorkspaceApiKey(target.id, workspace),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.updateWorkspaceApiKey(target.id, { permissions: [] }),
        ).rejects.toThrow(ForbiddenException);
        await expect(service.deleteWorkspaceApiKey(target.id)).rejects.toThrow(
          ForbiddenException,
        );
        const find = vi
          .spyOn(ConnectionManager.prototype, "find")
          .mockResolvedValue({ edges: [], pageInfo: {} } as never);
        await service.getWorkspaceApiKeyConnection(workspace, { first: 10 });
        expect(find).toHaveBeenCalledWith(
          WorkspaceApiKeyConnection,
          { first: 10 },
          {
            where: expect.objectContaining({
              ownerType: "workspace_member",
              permissions: { $contained: ["workspace:read"], $ne: [] },
            }),
            populate: ["owner"],
            exclude: ["key"],
          },
        );
        const otherWorkspace = Object.assign(createTestWorkspace(), {
          id: "workspace-2",
        });
        find.mockClear();
        await expect(
          service.getWorkspaceApiKeyConnection(otherWorkspace, { first: 10 }),
        ).rejects.toThrow(ForbiddenException);
        expect(find).not.toHaveBeenCalled();
        RequestContext.set(Workspace, otherWorkspace);
        await expect(
          service.createWorkspaceApiKey(otherWorkspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Wrong owner",
          }),
        ).rejects.toThrow(ForbiddenException);
        expect(em.remove).not.toHaveBeenCalled();
        expect(em.flush).not.toHaveBeenCalled();
      },
    );
    apiKeyTest("rejects invalid prefixes and permission values", async () => {
      const { em, service } = createService();
      const workspace = createTestWorkspace();
      await expect(
        service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Invalid prefix",
          prefix: "",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Whitespace prefix",
          prefix: "bad prefix-",
        }),
      ).rejects.toThrow(
        "API key prefix must contain 1–32 lowercase letters, digits, underscores, or hyphens and start with a lowercase letter",
      );
      await expect(
        service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Invalid permissions",
          permissions: [""],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(em.create).not.toHaveBeenCalled();
    });
    apiKeyTest(
      "rejects invalid prefix characters, length, and initial characters",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const user = createTestUser();
        for (const prefix of [
          "",
          "1a",
          "ABC",
          "aB",
          "-sk",
          "_sk",
          "a.b",
          "a b",
          " a",
          "a\n",
          "a\r",
          "a\u0000",
          "a\u007f",
          "é",
          "a😀",
          "a".repeat(33),
        ]) {
          await expect(
            service.createWorkspaceApiKey(workspace, {
              member: RequestContext.get(WorkspaceMember),
              name: "Invalid",
              prefix,
            }),
          ).rejects.toBeInstanceOf(BadRequestException);
          await expect(
            service.createUserApiKey(user, { name: "Invalid", prefix }),
          ).rejects.toBeInstanceOf(BadRequestException);
          // Environment variables cannot contain NUL (Node truncates at that byte).
          if (!prefix.includes("\u0000")) {
            vi.stubEnv("API_KEY_PREFIX", prefix);
            await expect(
              service.createUserApiKey(user, {
                name: "Invalid environment prefix",
              }),
            ).rejects.toBeInstanceOf(BadRequestException);
          }
        }
        expect(em.create).not.toHaveBeenCalled();
        expect(em.flush).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "isolates configured prefixes and lets explicit prefixes override defaults",
      async () => {
        vi.stubEnv("API_KEY_PREFIX", "shared_");
        const { service } = createService({
          apiKey: {
            user: { defaultPrefix: "personal_" },
            workspace: { defaultPrefix: "team_" },
          },
        });
        const userKey = await service.createUserApiKey(createTestUser(), {
          name: "User",
        });
        const memberKey = await service.createWorkspaceApiKey(
          createTestWorkspace(),
          {
            member: RequestContext.get(WorkspaceMember),
            name: "Workspace",
          },
        );
        expect(userKey.apiKey).toMatch(/^personal_[A-Za-z0-9_-]{64}$/u);
        expect(userKey.entity.prefix).toBe("personal_");
        expect(memberKey.apiKey).toMatch(/^team_[A-Za-z0-9_-]{64}$/u);
        expect(memberKey.entity.prefix).toBe("team_");
        for (const created of [
          await service.createUserApiKey(createTestUser(), {
            name: "Explicit",
            prefix: "custom_",
          }),
          await service.createWorkspaceApiKey(createTestWorkspace(), {
            member: RequestContext.get(WorkspaceMember),
            name: "Explicit",
            prefix: "custom_",
          }),
        ]) {
          expect(created.apiKey).toMatch(/^custom_[A-Za-z0-9_-]{64}$/u);
          expect(created.entity.prefix).toBe("custom_");
        }
        const { service: fallback } = createService({
          apiKey: { user: { defaultPrefix: "personal_" } },
        });
        expect(
          (
            await fallback.createWorkspaceApiKey(createTestWorkspace(), {
              member: RequestContext.get(WorkspaceMember),
              name: "Fallback",
            })
          ).entity.prefix,
        ).toBe("shared_");
      },
    );
    apiKeyTest(
      "rejects invalid configured prefixes before persistence",
      async () => {
        const { service, em } = createService({
          apiKey: {
            user: { defaultPrefix: "_invalid" },
            workspace: { defaultPrefix: "invalid prefix" },
          },
        });
        await expect(
          service.createUserApiKey(createTestUser(), { name: "Invalid" }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.createWorkspaceApiKey(createTestWorkspace(), {
            member: RequestContext.get(WorkspaceMember),
            name: "Invalid",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(em.create).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "accepts valid prefix boundaries and uses owner-specific defaults",
      async () => {
        vi.stubEnv("API_KEY_PREFIX", undefined);
        const { service } = createService();
        const user = createTestUser();
        const defaultKey = await service.createUserApiKey(user, {
          name: "Default",
        });
        expect(defaultKey.entity.prefix).toBe("user_");
        expect(defaultKey.apiKey).toMatch(/^user_[A-Za-z0-9_-]{64}$/u);
        const memberKey = await service.createWorkspaceApiKey(
          createTestWorkspace(),
          {
            member: RequestContext.get(WorkspaceMember),
            name: "Default workspace",
          },
        );
        expect(memberKey.entity.prefix).toBe("ws_");
        expect(memberKey.apiKey).toMatch(/^ws_[A-Za-z0-9_-]{64}$/u);
        for (const prefix of [
          "sk",
          "sk-",
          "a",
          "abc123-",
          "user_",
          "ws_",
          "a-b",
          "a".repeat(32),
          `${"a".repeat(31)}-`,
        ]) {
          const created = await service.createUserApiKey(user, {
            name: "Valid",
            prefix,
          });
          expect(created.entity.prefix).toBe(prefix);
          expect(created.apiKey.slice(0, prefix.length)).toBe(prefix);
          expect(created.apiKey.slice(prefix.length)).toMatch(
            /^[A-Za-z0-9_-]{64}$/u,
          );
        }
        vi.stubEnv("API_KEY_PREFIX", "invalid prefix");
        await expect(
          service.createUserApiKey(user, {
            name: "Explicit override",
            prefix: "a1",
          }),
        ).resolves.toBeDefined();
      },
    );
    apiKeyTest(
      "rejects inactive members before creating a workspace key",
      async () => {
        const { em, service } = createService();
        const workspace = createTestWorkspace();
        const member = createTestWorkspaceMember();
        member.status = "DISABLED";
        RequestContext.set(WorkspaceMember, member);
        await expect(
          service.createWorkspaceApiKey(workspace, {
            member: RequestContext.get(WorkspaceMember),
            name: "Deploy key",
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(em.create).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "checks workspace permissions instead of hard-coding an owner role",
      async () => {
        const { authorization, service } = createService();
        const workspace = createTestWorkspace();
        const member = Object.assign(createTestWorkspaceMember(), {
          roles: ["custom-api-key-manager"],
          workspace,
        });
        RequestContext.set(WorkspaceMember, member);
        await service.createWorkspaceApiKey(workspace, {
          member: RequestContext.get(WorkspaceMember),
          name: "Workspace key",
        });
        expect(authorization.assertCurrentWorkspaceMember).toHaveBeenCalledWith(
          member,
        );
        expect(authorization.authorize).toHaveBeenCalledWith(
          "write",
          WorkspaceApiKey,
        );
      },
    );
    apiKeyTest(
      "rejects creation from a member of another workspace",
      async () => {
        const { em, service } = createService();
        const member = Object.assign(createTestWorkspaceMember(), {
          roles: ["owner"],
          workspace: {
            id: "workspace-2",
          } as WorkspaceMember["workspace"],
        });
        RequestContext.set(WorkspaceMember, member);
        await expect(
          service.createWorkspaceApiKey(createTestWorkspace(), {
            member: RequestContext.get(WorkspaceMember),
            name: "Cross key",
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(em.create).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "rejects connection queries for a member of another workspace",
      async () => {
        const { service } = createService();
        const find = vi.spyOn(ConnectionManager.prototype, "find");
        const member = Object.assign(createTestWorkspaceMember(), {
          workspace: {
            id: "workspace-2",
          } as WorkspaceMember["workspace"],
        });
        RequestContext.set(WorkspaceMember, member);
        await expect(
          service.getWorkspaceApiKeyConnection(createTestWorkspace(), {
            first: 10,
          }),
        ).rejects.toThrow(ForbiddenException);
        expect(find).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "rejects workspace key access before persistence when permission fails",
      async () => {
        const { authorization, em, service } = createService();
        const apiKey = createTestApiKey();
        em.findOne.mockResolvedValue(apiKey);
        vi.mocked(authorization.authorize).mockImplementation(() => {
          throw new ForbiddenException();
        });
        await expect(
          service.getWorkspaceApiKey(apiKey.id, createTestWorkspace()),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.updateWorkspaceApiKey(apiKey.id, {
            name: "New",
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.deleteWorkspaceApiKey(apiKey.id),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(em.findOne).not.toHaveBeenCalled();
        expect(em.flush).not.toHaveBeenCalled();
      },
    );
    apiKeyTest(
      "does not let owners access keys from another workspace",
      async () => {
        const { em, service } = createService();
        const apiKey = createTestApiKey();
        const owner = apiKey.member;
        assert(owner);
        Reference.unwrapReference(owner).workspace = ref(
          Workspace,
          Object.assign(createTestWorkspace(), {
            id: "workspace-2",
          }),
        );
        em.findOne.mockResolvedValue(apiKey);
        RequestContext.set(WorkspaceMember, createTestWorkspaceMember());
        await expect(
          service.getWorkspaceApiKey(apiKey.id, createTestWorkspace()),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
    apiKeyTest("updates and deletes accessible keys", async () => {
      const { em, service } = createService();
      const apiKey = createTestApiKey();
      em.findOne.mockResolvedValue(apiKey);
      const expiresAt = new Date(Date.now() + 60000);
      const permissions = ["workspace:update"];
      const updated = await service.updateWorkspaceApiKey(apiKey.id, {
        expiresAt,
        name: "Renamed",
        permissions,
      });
      expect(updated).toMatchObject({
        id: apiKey.id,
        name: "Renamed",
        expiresAt,
        permissions,
      });
      expect(apiKey.name).toBe("Deploy key");
      expect(apiKey.expiresAt).toBeNull();
      const persisted = Object.assign(new ApiKey(), apiKey, {
        name: updated.name,
        expiresAt,
        permissions,
        updatedAt: updated.updatedAt,
      });
      em.findOne.mockResolvedValue(persisted);
      expect(await service.deleteWorkspaceApiKey(apiKey.id)).toEqual(updated);
      expect(em.remove).toHaveBeenCalledWith(persisted);
      expect(em.flush).toHaveBeenCalledOnce();
    });
  });
});
describe("conditional service authorization", () => {
  it.each(
    (
      [
        "user",
        "workspace",
        "member",
        "invitation",
        "user-key",
        "member-key",
      ] as const
    ).filter((_row, index) => index === 5),
  )("checks proposed %s fields before creation", async (kind) => {
    await withIdentity(
      async ({
        em,
        user,
        workspace,
        workspaceMemberService,
        workspaceInvitationService,
        workspaceService,
        userService,
        userApiKeyService,
        workspaceApiKeyService,
      }) => {
        em.findOne.mockResolvedValue(null);
        const create = () =>
          kind === "user"
            ? userService.createUser({
                name: "blocked",
                email: "new@example.com",
                password: "valid-password",
              })
            : kind === "workspace"
              ? workspaceService.createWorkspace(user, { name: "blocked" })
              : kind === "member"
                ? workspaceMemberService.addWorkspaceMember(
                    workspace,
                    Object.assign(new User(), {
                      id: "invitee",
                      name: "blocked",
                      email: "new@example.com",
                    }),
                  )
                : kind === "invitation"
                  ? workspaceInvitationService.createWorkspaceInvitation(
                      workspace,
                      user,
                      {
                        email: "blocked@example.com",
                      },
                    )
                  : kind === "user-key"
                    ? userApiKeyService.createUserApiKey(user, {
                        name: "blocked",
                      })
                    : workspaceApiKeyService.createWorkspaceApiKey(workspace, {
                        name: "blocked",
                      });
        await expect(create()).rejects.toThrow(ForbiddenException);
        expect(em.persist).not.toHaveBeenCalled();
      },
    );
  });
});

for (const field of ["name", "permissions", "expiresAt", "prefix"] as const) {
  apiKeyTest(`rejects creation when ${field} is not writable`, async () => {
    const configuration: AuthModuleOptions = {
      workspace: { enabled: true },
      buildAbility: ({ cannot }) => {
        cannot("write", WorkspaceApiKey, [field]);
      },
    };
    const { service, em, authorization } = createService(configuration);
    authorization.authorize.mockRestore();
    const user = Object.assign(createTestUser(), { roles: ["admin"] });
    stageIdentity({ user });
    createTestAuthContext(
      undefined,
      withAuthTestFeatures(configuration),
    ).refresh();
    const input = {
      name: "Denied",
      permissions: ["workspace:read"],
      expiresAt: new Date(Date.now() + 60_000),
      prefix: "custom_",
    };
    await expect(
      service.createWorkspaceApiKey(createTestWorkspace(), {
        ...input,
        member: createTestWorkspaceMember(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(em.persist.mock.calls).toHaveLength(0);
    expect(em.flush.mock.calls).toHaveLength(0);
  });
}
