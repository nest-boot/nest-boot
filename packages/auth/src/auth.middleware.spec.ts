import { EntityManager } from "@mikro-orm/core";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";
import { NextFunction, Request } from "express";
import type { Mock } from "vitest";

import { mockRlsContext } from "../test/mock-rls-context.js";
import { UserAbility } from "./abilities/user.ability.js";
import { WorkspaceAbility } from "./abilities/workspace.ability.js";
import { API_KEY } from "./auth.constants.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  Account as AccountEntity,
  Account as BaseAccount,
} from "./entities/account.entity.js";
import { authEntityMap } from "./entities/auth-entity-map.js";
import {
  Invitation as BaseInvitation,
  Invitation as InvitationEntity,
} from "./entities/invitation.entity.js";
import {
  Member as BaseMember,
  Member as MemberEntity,
} from "./entities/member.entity.js";
import {
  Session as BaseSession,
  Session as SessionEntity,
} from "./entities/session.entity.js";
import {
  User as BaseUser,
  User as UserEntity,
} from "./entities/user.entity.js";
import { UserApiKey } from "./entities/user-api-key.entity.js";
import {
  Verification as BaseVerification,
  Verification as VerificationEntity,
} from "./entities/verification.entity.js";
import {
  Workspace as BaseWorkspace,
  Workspace as WorkspaceEntity,
} from "./entities/workspace.entity.js";
import { WorkspaceApiKey } from "./entities/workspace-api-key.entity.js";
import {
  WorkspaceApiKey as ApiKeyEntity,
  WorkspaceApiKey as BaseApiKey,
} from "./entities/workspace-api-key.entity.js";
import { ApiKeyAuthenticationService } from "./infrastructure/api-key-authentication.service.js";
import { SessionService } from "./services/session.service.js";
const TestApiKey = BaseApiKey;
type TestApiKey = BaseApiKey;
const TestUser = BaseUser;
type TestUser = BaseUser;
const TestSession = BaseSession;
type TestSession = BaseSession;
const TestWorkspace = BaseWorkspace;
type TestWorkspace = BaseWorkspace;
const TestMember = BaseMember;
type TestMember = BaseMember;

const testEntities = {
  account: AccountEntity,
  userApiKey: UserApiKey,
  workspaceApiKey: ApiKeyEntity,
  session: SessionEntity,
  user: UserEntity,
  verification: VerificationEntity,
  workspace: WorkspaceEntity,
  invitation: InvitationEntity,
  member: MemberEntity,
};

async function createMiddleware(
  getCurrentAuthenticatedSession: Mock,
  findOne: Mock,
  validate = vi.fn(),
  entities: typeof authEntityMap = testEntities,
  options: Partial<AuthModuleOptions> = {},
) {
  const sessionService = {
    getCurrentAuthenticatedSession,
  } as unknown as SessionService;
  const em = {
    getContext: vi.fn().mockReturnThis(),
    getSessionContext: vi.fn(),
    setSessionContext: vi.fn(),
    isInTransaction: vi.fn(),
    fork: vi.fn(),
    findOne,
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthMiddleware,
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          ...options,
          entities,
        },
      },
      {
        provide: SessionService,
        useValue: sessionService,
      },
      {
        provide: ApiKeyAuthenticationService,
        useValue: { validate },
      },
      {
        provide: EntityManager,
        useValue: em,
      },
    ],
  }).compile();

  return {
    em,
    middleware: moduleRef.get(AuthMiddleware),
    validate,
  };
}

async function runInRequestContext<T>(
  request: Request,
  callback: () => Promise<T>,
): Promise<T> {
  const context = new RequestContext({ type: "http" });
  context.set(REQUEST, request);
  return await RequestContext.run(context, callback);
}

describe("AuthMiddleware", () => {
  it("revokes the replacement identity when its ability cannot be built", async () => {
    const user = Object.assign(new TestUser(), { id: "replacement" });
    const session = Object.assign(new TestSession(), {
      user,
      token: "replacement",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { middleware, em } = await createMiddleware(
      vi.fn(),
      vi.fn().mockResolvedValueOnce(session).mockResolvedValueOnce(user),
      vi.fn(),
      testEntities,
      {
        user: {
          buildAbility: () => {
            throw new Error("Invalid rules");
          },
        },
      },
    );
    mockRlsContext(em);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(BaseUser, new TestUser());
      RequestContext.set(BaseSession, new TestSession());
      await expect(
        middleware.authenticateSession("replacement"),
      ).rejects.toThrow("Invalid rules");
      expect(RequestContext.get(BaseUser)).toBeNull();
      expect(RequestContext.get(BaseSession)).toBeNull();
      expect(RequestContext.get(UserAbility)?.rules).toEqual([]);
      expect(RequestContext.get(WorkspaceAbility)?.rules).toEqual([]);
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "anonymous",
        variables: { "app.user.id": "", "app.workspace.id": "" },
      });
    });
  });

  it("hydrates registration results without authenticating the request or widening its database scope", async () => {
    const { middleware, em } = await createMiddleware(vi.fn(), vi.fn());
    const session = mockRlsContext(em);
    const user = Object.assign(new TestUser(), { id: "registered-user" });
    const fork = em.fork() as EntityManager;
    em.fork.mockClear();
    const findOneOrFail = vi.fn().mockResolvedValue(user);
    Object.assign(fork, { findOneOrFail });
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(EntityManager, em as unknown as EntityManager);
      await expect(middleware.resolveRegisteredUser(user.id)).resolves.toBe(
        user,
      );
      await middleware.refreshCurrentUser();
      expect(findOneOrFail).toHaveBeenCalledExactlyOnceWith(UserEntity, {
        id: user.id,
      });
      expect(RequestContext.get(UserEntity)).toBeUndefined();
      expect(RequestContext.get(SessionEntity)).toBeUndefined();
      expect(RequestContext.get(EntityManager)).toBe(em);
      expect(em.getSessionContext()).toBe(session);
      expect(em.setSessionContext).not.toHaveBeenCalled();
      expect(em.findOne).not.toHaveBeenCalled();
    });
  });

  it("clears identity, abilities and database scope through the sign-out middleware boundary", async () => {
    const { middleware, em } = await createMiddleware(vi.fn(), vi.fn());
    mockRlsContext(em);
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      RequestContext.set(UserEntity, new TestUser());
      RequestContext.set(SessionEntity, new TestSession());
      RequestContext.set(WorkspaceEntity, new TestWorkspace());
      RequestContext.set(MemberEntity, new TestMember());
      RequestContext.set(API_KEY, new WorkspaceApiKey());
      RequestContext.set(
        UserAbility,
        new UserAbility([{ action: "read", subject: UserEntity }]),
      );
      RequestContext.set(
        WorkspaceAbility,
        new WorkspaceAbility([{ action: "delete", subject: WorkspaceEntity }]),
      );

      middleware.clearAuthentication();

      for (const token of [
        UserEntity,
        SessionEntity,
        WorkspaceEntity,
        MemberEntity,
      ])
        expect(RequestContext.get(token)).toBeNull();
      expect(RequestContext.get(API_KEY)).toBeNull();
      expect(RequestContext.get(UserAbility)?.can("read", UserEntity)).toBe(
        false,
      );
      expect(
        RequestContext.get(WorkspaceAbility)?.can("delete", WorkspaceEntity),
      ).toBe(false);
      expect(em.setSessionContext).toHaveBeenCalledExactlyOnceWith({
        role: "anonymous",
        variables: { "app.user.id": "", "app.workspace.id": "" },
      });
    });
  });

  it.each([false, true])(
    "preserves case in RLS grants and API-key intersections (key: %s)",
    async (useKey) => {
      const user = Object.assign(new TestUser(), {
        id: "user-1",
        roles: ["editor"],
        permissions: ["User:read", "user:read"],
      });
      const workspace = Object.assign(new TestWorkspace(), {
        id: "workspace-1",
      });
      const member = Object.assign(new TestMember(), {
        user,
        workspace,
        roles: ["manager"],
        permissions: ["Workspace:update", "workspace:update"],
      });
      const apiKey = Object.assign(new UserApiKey(), {
        user,
        workspace: null,
        permissions: ["user:read", "Workspace:UPDATE"],
      });
      const { middleware, em } = await createMiddleware(
        vi
          .fn()
          .mockResolvedValue(
            useKey ? null : { user, session: new TestSession() },
          ),
        vi.fn().mockResolvedValueOnce(workspace).mockResolvedValueOnce(member),
        vi.fn().mockResolvedValue({ apiKey, user, ownerType: "user" }),
        testEntities,
        {
          user: { roles: { editor: ["User:READ"] } },
          workspace: { roles: { manager: ["Workspace:UPDATE"] } },
        },
      );
      const request = {
        headers: {
          "x-workspace-id": workspace.id,
          ...(useKey ? { authorization: "Bearer sk-key" } : {}),
        },
      } as unknown as Request;
      const next = vi.fn();
      await runInRequestContext(request, () =>
        middleware.use(request, {} as never, next),
      );
      expect(next).toHaveBeenCalledExactlyOnceWith();
      expect(em.setSessionContext).toHaveBeenCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": user.id,
          "app.workspace.id": workspace.id,
        },
      });
    },
  );

  it.each([
    ["anonymous", false],
    ["session", true],
    ["session", false],
    ["user-key", true],
    ["user-key", false],
    ["workspace-key", false],
  ] as const)(
    "stages only identities for %s (membership: %s)",
    async (kind, hasMember) => {
      const user = Object.assign(new TestUser(), {
        id: "user-1",
        roles: ["editor"],
        permissions: ["user:read", "user:delete"],
      });
      const workspace = Object.assign(new TestWorkspace(), {
        id: "workspace-1",
      });
      const member = Object.assign(new TestMember(), {
        roles: ["manager"],
        permissions: ["invitation:create", "workspace:update"],
        user,
        workspace,
      });
      const apiKey = Object.assign(
        kind === "workspace-key" ? new WorkspaceApiKey() : new UserApiKey(),
        {
          user: kind === "workspace-key" ? null : user,
          workspace: kind === "workspace-key" ? workspace : null,
          permissions:
            kind === "workspace-key"
              ? ["workspace:update"]
              : ["user:read", "workspace:update", "session:list"],
        },
      );
      const { middleware, em } = await createMiddleware(
        vi
          .fn()
          .mockResolvedValue(
            kind === "session" ? { user, session: new TestSession() } : null,
          ),
        vi
          .fn()
          .mockResolvedValueOnce(workspace)
          .mockResolvedValueOnce(hasMember ? member : null),
        vi.fn().mockResolvedValue({
          apiKey,
          user,
          workspace,
          ownerType: kind === "workspace-key" ? "workspace" : "user",
        }),
        testEntities,
        {
          user: { roles: { editor: ["user:read", "user:update"] } },
          workspace: {
            roles: { manager: ["member:read", "workspace:update"] },
          },
        },
      );
      const request = {
        headers: {
          "x-workspace-id": workspace.id,
          ...(kind.endsWith("key") ? { authorization: "Bearer sk-key" } : {}),
        },
      } as unknown as Request;
      const next = vi.fn();
      await runInRequestContext(request, () =>
        middleware.use(request, {} as never, next),
      );
      expect(next).toHaveBeenCalledExactlyOnceWith();
      expect(em.setSessionContext).toHaveBeenCalledExactlyOnceWith({
        role: kind === "anonymous" ? "anonymous" : "authenticated",
        variables: {
          "app.user.id":
            kind === "session" || kind === "user-key" ? user.id : "",
          "app.workspace.id":
            kind === "anonymous" || kind === "workspace-key" || hasMember
              ? workspace.id
              : "",
        },
      });
    },
  );

  it("refreshes the current profile without dropping its API-key permission ceiling", async () => {
    const user = Object.assign(new TestUser(), {
      id: "user",
      name: "New name",
      permissions: ["user:get", "user:delete"],
    });
    const key = Object.assign(new UserApiKey(), { permissions: ["user:get"] });
    const findOne = vi.fn().mockResolvedValue(user);
    const { middleware, em } = await createMiddleware(
      vi.fn(),
      findOne,
      vi.fn(),
      testEntities,
      {},
    );
    mockRlsContext(em);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(
        BaseUser,
        Object.assign(new TestUser(), { id: user.id, name: "Old name" }),
      );
      RequestContext.set(API_KEY, key);
      await middleware.refreshCurrentUser();
      expect(findOne).toHaveBeenCalledWith(
        BaseUser,
        { id: user.id },
        { refresh: true },
      );
      expect(RequestContext.get(BaseUser)).toBe(user);
      expect(RequestContext.get(API_KEY)).toBe(key);
      expect(RequestContext.get(UserAbility)?.can("read", BaseUser)).toBe(true);
      expect(RequestContext.get(UserAbility)?.can("delete", BaseUser)).toBe(
        false,
      );
      expect(em.setSessionContext).not.toHaveBeenCalled();
      findOne.mockResolvedValueOnce(null);
      await expect(middleware.refreshCurrentUser()).rejects.toThrow(
        "no longer available",
      );
      expect(RequestContext.get(BaseUser)).toBeNull();
      expect(RequestContext.get(API_KEY)).toBeNull();
      expect(em.setSessionContext).toHaveBeenLastCalledWith({
        role: "anonymous",
        variables: {
          "app.user.id": "",
          "app.workspace.id": "",
        },
      });
    });
  });

  it("rejects identity changes inside an existing transaction", async () => {
    const { middleware, em } = await createMiddleware(vi.fn(), vi.fn());
    em.isInTransaction.mockReturnValue(true);
    expect(() => {
      middleware.assertAuthenticationCanChange();
    }).toThrow("outside an active transaction");
    expect(em.setSessionContext).not.toHaveBeenCalled();
  });

  it("replaces stale identity and abilities when adopting a newly issued session", async () => {
    const user = Object.assign(new TestUser(), {
      id: "new-user",
      permissions: ["user:read"],
    });
    const session = Object.assign(new TestSession(), {
      user: { id: user.id },
      token: "new-token",
    });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    const { middleware, em } = await createMiddleware(vi.fn(), findOne);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(BaseUser, new TestUser());
      RequestContext.set(API_KEY, new TestApiKey());
      RequestContext.set(
        BaseWorkspace,
        Object.assign(new TestWorkspace(), { id: "old-workspace" }),
      );
      RequestContext.set(BaseMember, new TestMember());
      RequestContext.set(UserAbility, new UserAbility());
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
      await expect(middleware.authenticateSession("new-token")).resolves.toBe(
        user,
      );
      expect(RequestContext.get(BaseSession)).toBe(session);
      expect(RequestContext.get(BaseUser)).toBe(user);
      expect(RequestContext.get<BaseApiKey>(API_KEY)).toBeNull();
      expect(RequestContext.get(BaseMember)).toBeNull();
      expect(RequestContext.get(UserAbility)).toBeInstanceOf(UserAbility);
      expect(RequestContext.get(WorkspaceAbility)).toBeNull();
      expect(em.setSessionContext).toHaveBeenCalledWith({
        role: "authenticated",
        variables: {
          "app.user.id": "new-user",
          "app.workspace.id": "",
        },
      });
    });
  });

  it("does not adopt missing or banned sessions", async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const { middleware, em } = await createMiddleware(vi.fn(), findOne);
    await expect(middleware.authenticateSession("invalid")).rejects.toThrow(
      "not valid",
    );
    expect(findOne).toHaveBeenCalledWith(SessionEntity, {
      token: "invalid",
      expiresAt: { $gt: expect.any(Date) },
    });
    findOne
      .mockResolvedValueOnce({ user: { id: "banned" } })
      .mockResolvedValueOnce({ banned: true });
    await expect(
      middleware.authenticateSession("banned-token"),
    ).rejects.toThrow("not valid");
    expect(em.setSessionContext).not.toHaveBeenCalled();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["anonymous", false, false, "workspace-1"],
    ["session", true, true, "workspace-1"],
    ["session", true, false, ""],
    ["user-key", true, true, "workspace-1"],
    ["user-key", true, false, ""],
    ["workspace-key", false, false, "workspace-1"],
  ] as const)(
    "updates a staged session after %s authentication (user=%s, member=%s)",
    async (kind, hasUser, hasMember, expectedWorkspace) => {
      const user = Object.assign(new TestUser(), { id: "user-1" });
      const workspace = Object.assign(new TestWorkspace(), {
        id: "workspace-1",
      });
      const member = Object.assign(new TestMember(), {
        id: "member-1",
      });
      const findOne = vi
        .fn()
        .mockResolvedValueOnce(workspace)
        .mockResolvedValueOnce(hasMember ? member : null);
      const getCurrentAuthenticatedSession = vi
        .fn()
        .mockResolvedValue(
          kind === "session" ? { user, session: new TestSession() } : null,
        );
      const validate = vi.fn().mockResolvedValue({
        apiKey: new TestApiKey(),
        ownerType: kind === "user-key" ? "user" : "workspace",
        user,
        workspace,
      });
      const { middleware, em } = await createMiddleware(
        getCurrentAuthenticatedSession,
        findOne,
        validate,
      );
      mockRlsContext(em);
      const request = {
        headers: {
          "x-workspace-id": "workspace-1",
          ...(kind.endsWith("key") ? { authorization: "Bearer sk-key" } : {}),
        },
      } as unknown as Request;
      const next = vi.fn(() => {
        expect(em.setSessionContext).toHaveBeenCalledExactlyOnceWith({
          role: kind === "anonymous" ? "anonymous" : "authenticated",
          variables: {
            "app.user.id": hasUser ? "user-1" : "",
            "app.workspace.id": expectedWorkspace,
          },
        });
      });
      await runInRequestContext(request, () =>
        middleware.use(request, {} as never, next),
      );
      expect(next).toHaveBeenCalledExactlyOnceWith();
      if (hasUser) {
        expect(
          vi.mocked(em.setSessionContext).mock.invocationCallOrder[0],
        ).toBeGreaterThan(findOne.mock.invocationCallOrder[1]);
      }
    },
  );

  it("stages a database session even when the application did not configure one", async () => {
    const { middleware, em } = await createMiddleware(
      vi.fn().mockResolvedValue({
        user: new TestUser(),
        session: new TestSession(),
      }),
      vi.fn(),
    );
    const request = { headers: {} } as Request;
    const next = vi.fn();
    await runInRequestContext(request, () =>
      middleware.use(request, {} as never, next),
    );
    expect(em.setSessionContext).toHaveBeenCalledWith({
      role: "authenticated",
      variables: {
        "app.user.id": expect.any(String),
        "app.workspace.id": "",
      },
    });
    expect(next).toHaveBeenCalledExactlyOnceWith();
  });

  it("clears the selected workspace variable when no workspace resolves", async () => {
    const { middleware, em } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue(null),
    );
    mockRlsContext(em);
    const request = {
      headers: { "x-workspace-id": "missing" },
    } as unknown as Request;
    await runInRequestContext(request, () =>
      middleware.use(request, {} as never, vi.fn()),
    );
    expect(em.setSessionContext).toHaveBeenCalledWith({
      role: "anonymous",
      variables: {
        "app.user.id": "",
        "app.workspace.id": "",
      },
    });
  });

  it("forwards session staging errors without running the handler", async () => {
    const { middleware, em } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      vi.fn(),
    );
    mockRlsContext(em);
    const error = new Error("session cannot change during a transaction");
    vi.mocked(em.setSessionContext).mockImplementation(() => {
      throw error;
    });
    const request = { headers: {} } as Request;
    const next = vi.fn();
    await runInRequestContext(request, () =>
      middleware.use(request, {} as never, next),
    );
    expect(next).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("should continue without context when no session is returned", async () => {
    const getCurrentAuthenticatedSession = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn();
    const next = vi.fn() as NextFunction;
    const { middleware } = await createMiddleware(
      getCurrentAuthenticatedSession,
      findOne,
    );
    const request = {
      headers: {
        "x-empty": undefined,
        "x-test": ["a", "b"],
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);
    });

    expect(getCurrentAuthenticatedSession).toHaveBeenCalledWith();
    expect(findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not register self aliases when base entities are configured", async () => {
    const next = vi.fn() as NextFunction;
    const alias = vi.spyOn(RequestContext, "alias");
    const { middleware } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      vi.fn(),
      vi.fn(),
      {
        account: BaseAccount,
        userApiKey: UserApiKey,
        workspaceApiKey: BaseApiKey,
        session: BaseSession,
        user: BaseUser,
        verification: BaseVerification,
        workspace: BaseWorkspace,
        invitation: BaseInvitation,
        member: BaseMember,
      },
    );
    const request = { headers: {} } as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);
    });

    expect(alias).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should store authenticated user and session in request context", async () => {
    const user = {
      id: "user-1",
    };
    const session = {
      token: "session-token",
    };
    const getCurrentAuthenticatedSession = vi.fn().mockResolvedValue({
      session,
      user,
    });
    const findOne = vi.fn();
    const requestContextSet = vi.spyOn(RequestContext, "set");
    const requestContextAlias = vi.spyOn(RequestContext, "alias");
    const next = vi.fn() as NextFunction;
    const { middleware } = await createMiddleware(
      getCurrentAuthenticatedSession,
      findOne,
    );
    const request = {
      headers: {
        authorization: "Bearer token",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);

      expect(RequestContext.get(BaseUser)).toBe(user);
      expect(RequestContext.get(UserEntity)).toBe(user);
      expect(RequestContext.get(BaseSession)).toBe(session);
      expect(RequestContext.get(SessionEntity)).toBe(session);
    });

    expect(requestContextAlias).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
    expect(requestContextSet).toHaveBeenCalledWith(BaseUser, user);
    expect(requestContextSet).toHaveBeenCalledWith(BaseSession, session);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("gives a valid session precedence over a Bearer API key", async () => {
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
    });
    const getCurrentAuthenticatedSession = vi
      .fn()
      .mockResolvedValue({ session, user });
    const findOne = vi.fn();
    const validate = vi.fn();
    const { middleware } = await createMiddleware(
      getCurrentAuthenticatedSession,
      findOne,
      validate,
    );
    const request = {
      headers: { authorization: "Bearer sk-key" },
    } as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, vi.fn());
    });

    expect(validate).not.toHaveBeenCalled();
  });

  it("restores a user key and resolves membership in the selected workspace", async () => {
    const workspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
      name: "Acme",
    });
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const member = Object.assign(new TestMember(), {
      id: "member-1",
    });
    const apiKey = { id: "key-1" };
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(member);
    const validate = vi.fn().mockResolvedValue({
      apiKey,
      ownerType: "user",
      user,
    });
    const { middleware } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      findOne,
      validate,
    );
    const set = vi.spyOn(RequestContext, "set");
    const request = {
      headers: {
        authorization: "Bearer sk-key",
        "x-workspace-id": "workspace-1",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, vi.fn());

      expect(RequestContext.get(WorkspaceEntity)).toBe(workspace);
      expect(RequestContext.get(API_KEY)).toBe(apiKey);
      expect(RequestContext.get(UserEntity)).toBe(user);
      expect(RequestContext.get(MemberEntity)).toBe(member);
    });

    expect(validate).toHaveBeenCalledWith("sk-key");
    expect(set).toHaveBeenCalledWith(BaseWorkspace, workspace);
    expect(set).toHaveBeenCalledWith(API_KEY, apiKey);
    expect(set).toHaveBeenCalledWith(BaseUser, user);
    expect(findOne).toHaveBeenLastCalledWith(expect.any(Function), {
      status: "ACTIVE",
      user,
      workspace,
    });
    expect(set).toHaveBeenCalledWith(BaseMember, member);
  });

  it("does not restore a disabled membership into the auth context", async () => {
    const workspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
    });
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(null);
    const validate = vi.fn().mockResolvedValue({
      apiKey: { id: "key-1" },
      ownerType: "user",
      user,
    });
    const { middleware } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      findOne,
      validate,
    );
    const set = vi.spyOn(RequestContext, "set");
    const request = {
      headers: {
        authorization: "Bearer sk-key",
        "x-workspace-id": "workspace-1",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, vi.fn());
    });

    expect(findOne).toHaveBeenLastCalledWith(expect.any(Function), {
      status: "ACTIVE",
      user,
      workspace,
    });
    expect(set).not.toHaveBeenCalledWith(BaseMember, expect.anything());
  });

  it("restores a workspace key and rejects a conflicting workspace selector", async () => {
    const selectedWorkspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
      name: "Selected",
    });
    const ownerWorkspace = Object.assign(new TestWorkspace(), {
      id: "workspace-2",
      name: "Owner",
    });
    const validate = vi.fn().mockResolvedValue({
      apiKey: { id: "key-1" },
      ownerType: "workspace",
      workspace: ownerWorkspace,
    });
    const { middleware } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue(selectedWorkspace),
      validate,
    );
    const next = vi.fn();
    const request = {
      headers: {
        authorization: "Bearer sk-key",
        "x-workspace-id": "workspace-1",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it("reads the selected workspace from the raw Cookie header", async () => {
    const workspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
      name: "Acme",
    });
    const findOne = vi.fn().mockResolvedValue(workspace);
    const { middleware } = await createMiddleware(
      vi.fn().mockResolvedValue(null),
      findOne,
    );
    const request = {
      headers: {
        cookie: "unrelated=value; workspace_id=workspace-1",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, vi.fn());
      expect(RequestContext.get(BaseWorkspace)).toBe(workspace);
    });

    expect(findOne).toHaveBeenCalledWith(WorkspaceEntity, {
      id: "workspace-1",
    });
  });
});
