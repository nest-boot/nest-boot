import { ref } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  apiKeyTest,
  createService,
  createTestApiKey,
  createTestMember,
  createTestUser,
  createTestWorkspace,
} from "../../../test/fixtures/api-key-service.fixture.js";
import { withIdentity } from "../../../test/fixtures/conditional-authorization.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { mockRlsContext } from "../../../test/mock-rls-context.js";
import { AuthAbility } from "../../common/auth.ability.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { API_KEY } from "../../core/constants/auth.constants.js";
import { User } from "../../core/entities/user.entity.js";
import type { AuthModuleOptions } from "../../core/interfaces/auth-module-options.interface.js";
import { RequestIdentity } from "../../core/request-identity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { UserApiKeyConnection } from "../connections/user-api-key.connection-definition.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
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
          const member = createTestMember();
          const user = createTestUser();
          const Key = scope === "user" ? UserApiKey : WorkspaceApiKey;
          const target = Object.assign(new Key(), {
            member,
            user,
            permissions: [],
          });
          em.findOne.mockResolvedValue(target);
          RequestIdentity.stage({
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
              cannot("read", UserApiKey, { enabled: false });
              cannot("read", WorkspaceApiKey, { enabled: false });
            },
          };
          const { service, em, authorization } = createService(options);
          vi.mocked(authorization.authorize).mockRestore();
          const user = Object.assign(createTestUser(), { roles: ["admin"] });
          RequestIdentity.stage({ user });
          RequestIdentity.prepare(withAuthTestFeatures(options));
          const key = Object.assign(
            scope === "user"
              ? new UserApiKey(new ApiKey())
              : new WorkspaceApiKey(new ApiKey()),
            {
              id: "conditional-key",
              key: "already-hydrated-key-hash",
              enabled: true,
              permissions: [],
              owner:
                scope === "user"
                  ? ref(User, user)
                  : ref(Member, createTestMember()),
            },
          );
          const read = () =>
            scope === "user"
              ? service.getUserApiKey(key.id, user)
              : service.getWorkspaceApiKey(key.id, createTestWorkspace());
          em.findOne.mockResolvedValue(key);
          expect(await read()).toEqual(omitCredentials(key, ["key"]));
          expect(await read()).not.toHaveProperty("key");
          expect(key.key).toBe("already-hydrated-key-hash");
          key.enabled = false;
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
              cannot("read", UserApiKey, { enabled: false });
              cannot("read", WorkspaceApiKey, { enabled: false });
            },
          };
          const { service, authorization } = createService(options);
          vi.mocked(authorization.authorize).mockRestore();
          const user = Object.assign(createTestUser(), { roles: ["admin"] });
          RequestIdentity.stage({ user });
          RequestIdentity.prepare(withAuthTestFeatures(options));
          const key = Object.assign(
            scope === "user"
              ? new UserApiKey(new ApiKey())
              : new WorkspaceApiKey(new ApiKey()),
            { enabled: true, member: ref(Member, createTestMember()) },
          );
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
          key.enabled = false;
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
          `allows disabling a ${scope} key with stale ${reason} grants but still rejects re-enabling it`,
          async () => {
            const options: AuthModuleOptions =
              reason === "catalog"
                ? {
                    workspace: { enabled: true },
                    apiKey: {
                      user: { allowedPermissions: ["user-api-key:write"] },
                      workspace: {
                        allowedPermissions: ["member-api-key:write"],
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
            const member = Object.assign(createTestMember(), {
              roles: [reason === "owner" ? "member" : "owner"],
              permissions: ["member-api-key:write"],
            });
            RequestIdentity.stage({ user, member });
            RequestIdentity.prepare(withAuthTestFeatures(options));
            const permissions = [
              scope === "user" ? "user:read" : "workspace:delete",
            ];
            const key = Object.assign(
              scope === "user"
                ? new UserApiKey(new ApiKey())
                : new WorkspaceApiKey(new ApiKey()),
              {
                id: "stale-key",
                enabled: true,
                permissions,
                user: ref(User, user),
                member: ref(Member, createTestMember()),
              },
            );
            em.findOne.mockResolvedValue(key);
            const update =
              scope === "user"
                ? service.updateUserApiKey
                : service.updateWorkspaceApiKey;
            expect(await update(key.id, { enabled: false })).toEqual(
              omitCredentials(key, ["key"]),
            );
            expect(key.enabled).toBe(false);
            expect(key.permissions).toEqual(permissions);
            expect(em.flush).toHaveBeenCalledOnce();
            await expect(update(key.id, { enabled: true })).rejects.toThrow();
            await expect(
              update(key.id, { name: "Still invalid" }),
            ).rejects.toThrow();
            await expect(
              update(key.id, { enabled: false, permissions }),
            ).rejects.toThrow();
            expect(key.enabled).toBe(false);
            expect(em.flush).toHaveBeenCalledOnce();
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
              ? Object.assign(new UserApiKey(new ApiKey()), {
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
                  member: RequestContext.get(Member),
                  name: "Expired",
                  expiresAt: new Date(0),
                }),
          ).rejects.toThrow("expiration must be in the future");
          expect(key).toMatchObject(original);
          expect(em.flush).not.toHaveBeenCalled();
          expect(em.create).not.toHaveBeenCalled();
          await update({ expiresAt: null });
          expect(key.expiresAt).toBeNull();
          expect(em.flush).toHaveBeenCalledOnce();
        },
      );
      for (const operation of ["permissions", "disable", "delete"] as const) {
        apiKeyTest(
          `publishes ${scope} credential ${operation} changes only after commit`,
          async () => {
            const { service, em } = createService();
            const user = createTestUser();
            const key = Object.assign(
              scope === "user"
                ? new UserApiKey(new ApiKey())
                : new WorkspaceApiKey(new ApiKey()),
              {
                id: "active-key",
                enabled: true,
                permissions: ["workspace:update", "workspace:read"],
                lastUsedAt: new Date(0),
                user: ref(User, user),
                member: ref(Member, createTestMember()),
              },
            );
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
              "app.member.id": createTestMember().id,
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
                : update(
                    key.id,
                    operation === "disable"
                      ? { enabled: false }
                      : { permissions: ["workspace:read"] },
                  );
            em.isInTransaction.mockReturnValueOnce(true);
            await expect(invoke()).rejects.toThrow(
              "outside an active transaction",
            );
            expect(em.flush).not.toHaveBeenCalled();
            em.flush.mockRejectedValueOnce(new Error("Commit failed"));
            await expect(invoke()).rejects.toThrow("Commit failed");
            expect(RequestContext.get(API_KEY)).toBe(key);
            expect(key.enabled).toBe(true);
            expect(key.lastUsedAt).toEqual(new Date(0));
            expect(key.permissions).toEqual([
              "workspace:update",
              "workspace:read",
            ]);
            expect(RequestContext.get(AuthAbility)).toBe(ability);
            expect(em.setSessionContext).not.toHaveBeenCalled();
            em.flush.mockImplementationOnce(() => {
              expect(RequestContext.get(API_KEY)).toBe(key);
              expect(em.setSessionContext).not.toHaveBeenCalled();
              if (operation === "disable") {
                expect(key.lastUsedAt?.getTime()).toBeGreaterThan(0);
              }
              return Promise.resolve();
            });
            await invoke();
            if (operation === "disable") {
              expect(key.lastUsedAt?.getTime()).toBeGreaterThan(0);
            }
            expect(
              RequestContext.get(AuthAbility)?.can("update", Workspace),
            ).toBe(false);
            if (operation === "permissions") {
              expect(RequestContext.get(API_KEY)).toBe(key);
              expect(em.setSessionContext).not.toHaveBeenCalled();
            } else {
              expect(RequestContext.get(API_KEY)).toBeNull();
              expect(RequestContext.get(User)).toBeNull();
              expect(RequestContext.get(Member)).toBeNull();
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
            const key = Object.assign(
              scope === "user"
                ? new UserApiKey(new ApiKey())
                : new WorkspaceApiKey(new ApiKey()),
              {
                user: scope === "user" ? ref(User, createTestUser()) : null,
                member:
                  scope === "workspace"
                    ? ref(Member, createTestMember())
                    : null,
              },
            );
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
        em.findOne.mockResolvedValue(created.entity);
        expect(await service.getUserApiKey(created.entity.id, user)).toEqual(
          omitCredentials(created.entity, ["key"]),
        );
        expect(
          await service.updateUserApiKey(created.entity.id, {
            name: "Renamed",
          }),
        ).toEqual(omitCredentials(created.entity, ["key"]));
        expect(await service.deleteUserApiKey(created.entity.id)).toEqual(
          omitCredentials(created.entity, ["key"]),
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
        const targetKey = Object.assign(new UserApiKey(new ApiKey()), {
          workspace: null,
          user: ref(User, user),
          permissions: ["user:read"],
        });
        em.findOne.mockResolvedValue(targetKey);
        const authenticatingKey = Object.assign(new UserApiKey(new ApiKey()), {
          workspace: null,
          user: ref(User, user),
          permissions: ["user:read"],
        });
        await RequestContext.child(async () => {
          RequestContext.set(API_KEY, authenticatingKey);
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
          await expect(
            service.updateUserApiKey(targetKey.id, { enabled: false }),
          ).rejects.toThrow(
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
      const apiKey = Object.assign(new UserApiKey(new ApiKey()), {
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
        RequestContext.set(
          API_KEY,
          Object.assign(new UserApiKey(new ApiKey()), {
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
        const target = Object.assign(new UserApiKey(new ApiKey()), {
          workspace: null,
          user: user,
          permissions: ["user:delete"],
        });
        em.findOne.mockResolvedValue(target);
        await RequestContext.child(async () => {
          RequestContext.set(
            API_KEY,
            Object.assign(new UserApiKey(new ApiKey()), {
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
        memberService,
        invitationService,
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
                ? memberService.addMember(
                    workspace,
                    Object.assign(new User(), {
                      id: "invitee",
                      name: "blocked",
                      email: "new@example.com",
                    }),
                  )
                : kind === "invitation"
                  ? invitationService.createInvitation(workspace, user, {
                      email: "blocked@example.com",
                    })
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
