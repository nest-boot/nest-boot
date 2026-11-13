import { ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

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
import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import type { ApiKeyObject } from "../objects/api-key.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";

/* eslint-disable @typescript-eslint/unbound-method */
describe("API-key management", () => {
  describe("API-key management services", () => {
    for (const scope of (["user", "member"] as const).filter(
      (_row, index) => index === 0,
    )) {
      apiKeyTest(
        `prevents a restricted ${scope} key from creating or managing inherited keys`,
        async () => {
          const { service, em } = createService();
          const member = createTestWorkspaceMember();
          const user = createTestUser();
          const Key = scope === "user" ? UserApiKey : WorkspaceApiKey;
          const target = Object.assign(new Key(), {
            member,
            user,
            permissions: [],
          });
          em.findOne.mockResolvedValue(target);
          stageIdentity({
            apiKey: Object.assign(new Key(), {
              member,
              user,
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
    for (const scope of (["user", "workspace"] as const).filter(
      (_row, index) => index === 0,
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
            RequestContext.set<ApiKeyObject | null>(ApiKey, key);
            const ability = new AuthAbility([
              { action: "update", subject: Workspace },
            ]);
            RequestContext.set(AuthAbility, ability);
            em.findOne.mockResolvedValue(key);
            mockRlsContext(em).variables = {
              "app.auth.user.id": user.id,
              "app.auth.workspace.id": createTestWorkspace().id,
              "app.selected.workspace.id": createTestWorkspace().id,
              "app.auth.workspace_member.id": createTestWorkspaceMember().id,
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
            expect(RequestContext.get(ApiKey)).toMatchObject(toApiKeyView(key));
            expect(key.revokedAt).toBeNull();
            expect(key.lastUsedAt).toEqual(new Date(0));
            expect(key.permissions).toEqual([
              "workspace:update",
              "workspace:read",
            ]);
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            expect(em.setSessionContext).not.toHaveBeenCalled();
            const beforeCommit = () => {
              expect(RequestContext.get(ApiKey)).toMatchObject(
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
              expect(RequestContext.get(ApiKey)).toMatchObject(changed);
              expect(em.setSessionContext).not.toHaveBeenCalled();
            } else {
              expect(RequestContext.get(ApiKey)).toBeNull();
              expect(RequestContext.get(User)).toBeNull();
              expect(RequestContext.get(WorkspaceMember)).toBeNull();
              expect(
                RequestContext.get<Workspace | null>(SELECTED_WORKSPACE),
              ).toBeInstanceOf(Workspace);
              expect(em.setSessionContext).toHaveBeenCalledWith({
                role: "anonymous",
                variables: {
                  "app.auth.user.id": "",
                  "app.auth.workspace.id": "",
                  "app.selected.workspace.id":
                    RequestContext.get<Workspace | null>(SELECTED_WORKSPACE)
                      ?.id,
                  "app.auth.workspace_member.id": "",
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
      "rejects personal key connections for another user before querying",
      async () => {
        const { service, authorization } = createService();
        vi.mocked(authorization.assertCurrentUser).mockRestore();
        RequestContext.set(User, createTestUser());
        const otherUser = Object.assign(createTestUser(), { id: "user-2" });
        const find = vi.spyOn(ConnectionManager.prototype, "find");
        await expect(
          service.getUserApiKeyConnection(otherUser, { first: 10 }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(find).not.toHaveBeenCalled();
      },
    );
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });
    apiKeyTest(
      "creates, reads, updates, and deletes keys owned by the current user",
      async () => {
        const { em, service } = createService();
        const user = createTestUser();
        user.permissions = ["user:read"];
        const created = await service.createUserApiKey(user, {
          name: "Personal automation",
          permissions: ["user:read", "workspace:update"],
        });
        expect(em.create).toHaveBeenCalledWith(
          ApiKey,
          expect.objectContaining({ owner: user }),
        );
        em.findOne.mockResolvedValue(
          em.create.mock.results.find(
            (result) => result.value.id === created.entity.id,
          )?.value,
        );
        expect(await service.getUserApiKey(created.entity.id, user)).toEqual(
          omitCredentials(created.entity, ["key"]),
        );
        const updated = await service.updateUserApiKey(created.entity.id, {
          name: "Renamed",
        });
        expect(updated).toMatchObject({
          id: created.entity.id,
          name: "Renamed",
          permissions: created.entity.permissions,
        });
        const native = em.create.mock.results.find(
          (result) => result.value.id === created.entity.id,
        )?.value;
        em.findOne.mockResolvedValue(
          Object.assign(new ApiKey(), native, {
            name: updated.name,
            updatedAt: updated.updatedAt,
          }),
        );
        expect(await service.deleteUserApiKey(created.entity.id)).toEqual(
          updated,
        );
      },
    );
    apiKeyTest(
      "allows user keys to combine configured user and workspace permissions",
      async () => {
        const { em, service } = createService();
        const permissions = ["user:read", "workspace:update"];
        const user = createTestUser();
        user.permissions = ["user:read"];
        await service.createUserApiKey(user, {
          name: "Cross-scope automation",
          permissions,
        });
        expect(em.create).toHaveBeenCalledWith(
          ApiKey,
          expect.objectContaining({ permissions }),
        );
      },
    );
    apiKeyTest(
      "prevents user keys from exceeding the owner's user permissions",
      async () => {
        const { em, service } = createService();
        const user = createTestUser();
        await expect(
          service.createUserApiKey(user, {
            name: "Workspace automation",
            permissions: ["workspace:update"],
          }),
        ).resolves.toBeDefined();
        await expect(
          service.createUserApiKey(user, {
            name: "Escalated user key",
            permissions: ["user:read"],
          }),
        ).rejects.toThrow(
          "User API key permissions exceed owner permissions: user:read",
        );
        user.roles = ["admin"];
        await expect(
          service.createUserApiKey(user, {
            name: "Administrator key",
            permissions: ["user:read"],
          }),
        ).resolves.toBeDefined();
        expect(em.create).toHaveBeenCalledTimes(2);
      },
    );
    apiKeyTest(
      "prevents user API keys from delegating permissions they do not have",
      async () => {
        const { em, service } = createService();
        const user = Object.assign(createTestUser(), { roles: ["admin"] });
        const targetKey = Object.assign(new ApiKey(), {
          workspace: null,
          user: ref(User, user),
          permissions: ["user:read"],
        });
        em.findOne.mockResolvedValue(targetKey);
        const authenticatingKey = Object.assign(new ApiKey(), {
          workspace: null,
          user: ref(User, user),
          permissions: ["user:read"],
        });
        await RequestContext.child(async () => {
          RequestContext.set<ApiKeyObject | null>(ApiKey, authenticatingKey);
          await expect(
            service.createUserApiKey(user, {
              name: "Escalated delegated key",
              permissions: ["user:delete"],
            }),
          ).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: user:delete",
          );
          await expect(
            service.updateUserApiKey(targetKey.id, {
              permissions: ["user:delete"],
            }),
          ).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: user:delete",
          );
          targetKey.permissions = ["user:delete"];
          await expect(service.revokeUserApiKey(targetKey.id)).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: user:delete",
          );
          await expect(
            service.updateUserApiKey(targetKey.id, {
              name: "Still escalated",
            }),
          ).rejects.toThrow(
            "API key permissions exceed authenticating API key permissions: user:delete",
          );
          targetKey.permissions = [];
          await expect(
            service.createUserApiKey(user, {
              name: "Allowed delegated key",
              permissions: ["user:read"],
            }),
          ).resolves.toBeDefined();
        });
      },
    );
    apiKeyTest("does not let one user manage another user's key", async () => {
      const { em, service } = createService();
      const apiKey = Object.assign(new ApiKey(), {
        workspace: null,
        user: createTestUser(),
      });
      em.findOne.mockResolvedValue(apiKey);
      const otherUser = Object.assign(createTestUser(), { id: "user-2" });
      await expect(
        service.getUserApiKey(apiKey.id, otherUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    apiKeyTest(
      "filters personal key connections at the database permission boundary",
      async () => {
        const { service } = createService();
        const user = createTestUser();
        RequestContext.set<ApiKeyObject | null>(
          ApiKey,
          Object.assign(new ApiKey(), {
            workspace: null,
            user: user,
            permissions: ["user:read"],
          }),
        );
        const find = vi
          .spyOn(ConnectionManager.prototype, "find")
          .mockResolvedValue({ edges: [], pageInfo: {} } as never);
        await service.getUserApiKeyConnection(user, { first: 10 });
        expect(find).toHaveBeenCalledWith(
          UserApiKeyConnection,
          { first: 10 },
          {
            where: {
              owner: user,
              ownerType: "user",
              permissions: { $contained: ["user:read"], $ne: [] },
            },
            exclude: ["key"],
          },
        );
      },
    );
    apiKeyTest(
      "prevents authenticating keys from reading, downgrading, or deleting broader keys",
      async () => {
        const { em, service } = createService();
        const user = Object.assign(createTestUser(), { roles: ["admin"] });
        const target = Object.assign(new ApiKey(), {
          workspace: null,
          user: user,
          permissions: ["user:delete"],
        });
        em.findOne.mockResolvedValue(target);
        await RequestContext.child(async () => {
          RequestContext.set<ApiKeyObject | null>(
            ApiKey,
            Object.assign(new ApiKey(), {
              workspace: null,
              user: user,
              permissions: ["user:read"],
            }),
          );
          await expect(service.getUserApiKey(target.id, user)).rejects.toThrow(
            ForbiddenException,
          );
          await expect(
            service.updateUserApiKey(target.id, { permissions: [] }),
          ).rejects.toThrow(ForbiddenException);
          await expect(service.deleteUserApiKey(target.id)).rejects.toThrow(
            ForbiddenException,
          );
          expect(em.remove).not.toHaveBeenCalled();
          expect(em.flush).not.toHaveBeenCalled();
          expect(target.permissions).toEqual(["user:delete"]);
        });
      },
    );
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
    ).filter((_row, index) => index === 4),
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
        cannot("write", UserApiKey, [field]);
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
      permissions: ["user-api-key:read"],
      expiresAt: new Date(Date.now() + 60_000),
      prefix: "custom_",
    };
    await expect(service.createUserApiKey(user, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(em.persist.mock.calls).toHaveLength(0);
    expect(em.flush.mock.calls).toHaveLength(0);
  });
}
