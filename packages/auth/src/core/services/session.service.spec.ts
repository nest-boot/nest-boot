/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, LockMode } from "@mikro-orm/core";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { REQUEST, RequestContext, RESPONSE } from "@nest-boot/request-context";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { makeSignature } from "better-auth/crypto";
import { parseCookie } from "cookie";
import { type Mocked } from "vitest";

import { createTestAuthContext } from "../../../test/fixtures/auth-context.fixture.js";
import { withIdentity } from "../../../test/fixtures/conditional-authorization.fixture.js";
import { mockAuthorization } from "../../../test/mock-authorization.js";
import { mockRlsContext } from "../../../test/mock-rls-context.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { omitCredentials } from "../../common/utils/omit-credentials.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceInvitation } from "../../workspace/entities/workspace-invitation.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { AuthContext } from "../auth-context.js";
import { SessionConnection } from "../connections/session.connection-definition.js";
import { API_KEY, AUTH_TOKEN } from "../constants/auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { SessionService } from "./session.service.js";

const requestHeaders = vi.hoisted(
  () => new Headers({ cookie: "session=value" }),
);

vi.mock("@nest-boot/request-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nest-boot/request-context")>()),
  headers: () => requestHeaders,
}));

/**
 * Returns mock Better Auth API methods.
 * @returns Mock Better Auth API methods.
 */
function createApi() {
  return {
    getSession: vi.fn(),
    listSessions: vi.fn(),
    revokeOtherSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeSessions: vi.fn(),
  };
}

const authContext = {
  authCookies: {
    accountData: {
      name: "better-auth.account_data",
      attributes: { httpOnly: true, path: "/", sameSite: "lax" as const },
    },
    dontRememberToken: {
      name: "better-auth.dont_remember",
      attributes: { httpOnly: true, path: "/", sameSite: "lax" as const },
    },
    sessionData: {
      name: "better-auth.session_data",
      attributes: { httpOnly: true, path: "/", sameSite: "lax" as const },
    },
    sessionToken: {
      name: "better-auth.session_token",
      attributes: {
        httpOnly: true,
        maxAge: 604800,
        path: "/",
        sameSite: "lax" as const,
      },
    },
  },
  secret: "R4vWrEDXeeor7VzGzQsdbQobOFtv2nRrlhOVTGpOteA",
};

/**
 * Returns test service and its mocked dependencies.
 * @param api - Better Auth API implementation.
 * @param em - Entity manager used for persistence.
 * @param em.find - Mock for retrieving matching entities.
 * @param em.findOne - Mock for retrieving one matching entity.
 * @returns Test service and its mocked dependencies.
 */
async function createService(
  api = createApi(),
  em: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  } = {
    find: vi.fn(),
    findOne: vi.fn(),
  },
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SessionService,
      {
        provide: AuthContext,
        inject: [EntityManager],
        useFactory: (manager: EntityManager) => createTestAuthContext(manager),
      },
      {
        provide: AUTH_TOKEN,
        useValue: { $context: Promise.resolve(authContext), api },
      },
      {
        provide: EntityManager,
        useValue: {
          getContext: vi.fn().mockReturnThis(),
          getSessionContext: vi.fn(),
          isInTransaction: vi.fn(() => false),
          ...em,
        },
      },
    ],
  }).compile();
  return {
    api,
    em,
    service: moduleRef.get(SessionService),
  };
}

/**
 * Runs a session-only operation under an explicitly authenticated request.
 * @param run - Operation and assertions to execute.
 * @returns Result of the request operation.
 */
async function inSession<T>(run: () => Promise<T>): Promise<T> {
  return await RequestContext.run(
    new RequestContext({ type: "test" }),
    async () => {
      RequestContext.set(
        Session,
        Object.assign(new Session(), { id: "current", token: "current-token" }),
      );
      return await run();
    },
  );
}

describe("SessionService", () => {
  beforeEach(() => {
    requestHeaders.delete("authorization");
    requestHeaders.set("cookie", "session=value");
  });
  it("binds upstream calls to the current session and removes stale authentication and caches", async () => {
    const { service } = await createService();
    requestHeaders.set("authorization", "Bearer another-credential");
    const originalCookie = [
      "application=value",
      "better-auth.session_token=old-session",
      "better-auth.session_data=old-cache",
      "better-auth.session_data.0=chunk",
      "better-auth.session_data.01=another-chunk",
      "better-auth.account_data=old-account",
      "better-auth.account_data.0=account-chunk",
    ].join("; ");
    requestHeaders.set("cookie", originalCookie);
    await inSession(async () => {
      const result = await service.getCurrentSessionHeaders();
      expect(result.get("authorization")).toBeNull();
      expect(parseCookie(result.get("cookie") ?? "")).toEqual({
        application: "value",
        "better-auth.session_token": `current-token.${await makeSignature("current-token", authContext.secret)}`,
      });
      RequestContext.set(
        Session,
        Object.assign(new Session(), { token: "rotated-token" }),
      );
      const rotated = await service.getCurrentSessionHeaders();
      expect(
        parseCookie(rotated.get("cookie") ?? "")["better-auth.session_token"],
      ).toBe(
        `rotated-token.${await makeSignature("rotated-token", authContext.secret)}`,
      );
      const selected = await service.getCurrentSessionHeaders(true);
      expect(parseCookie(selected.get("cookie") ?? "")).toMatchObject({
        "better-auth.account_data": "old-account",
        "better-auth.account_data.0": "account-chunk",
      });
      expect(
        parseCookie(selected.get("cookie") ?? "")["better-auth.session_data"],
      ).toBeUndefined();
    });
    expect(requestHeaders.get("cookie")).toBe(originalCookie);
    expect(requestHeaders.get("authorization")).toBe(
      "Bearer another-credential",
    );
  });
  it.each(["anonymous", "user-only", "api-key"] as const)(
    "rejects %s self-service without calling Better Auth or changing identity",
    async (principal) => {
      const { service, api, em } = await createService();
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          if (principal !== "anonymous") {
            RequestContext.set(User, new User());
          }
          const key = new WorkspaceApiKey(new ApiKey());
          if (principal === "api-key") {
            RequestContext.set(
              Session,
              Object.assign(new Session(), { token: "session-token" }),
            );
            RequestContext.set(API_KEY, key);
          }
          for (const invoke of [
            () => service.getCurrentSessionHeaders(),
            () => service.listCurrentUserSessions(),
            () => service.revokeCurrentUserSession("target"),
            () => service.revokeCurrentUserOtherSessions(),
            () => service.revokeCurrentUserSessions(),
          ]) {
            await expect(invoke()).rejects.toThrow(ForbiddenException);
          }
          if (principal === "api-key") {
            expect(RequestContext.get(API_KEY)).toBe(key);
          }
        },
      );
      for (const operation of Object.values(api)) {
        expect(operation).not.toHaveBeenCalled();
      }
      expect(em.find).not.toHaveBeenCalled();
    },
  );
  it("resolves configured application user and session entities", async () => {
    const api = createApi();
    const user = Object.assign(new User(), { id: "user-1" });
    const session = Object.assign(new Session(), {
      token: "session-token",
    });
    api.getSession.mockResolvedValue({
      session: { token: session.token },
      user: { id: user.id },
    });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(session),
    };
    const { service } = await createService(api, em);
    await expect(service.getCurrentAuthenticatedSession()).resolves.toEqual({
      session,
      user,
    });
    expect(api.getSession).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(em.findOne).toHaveBeenNthCalledWith(1, User, { id: "user-1" });
    expect(em.findOne).toHaveBeenNthCalledWith(2, Session, {
      token: "session-token",
    });
    expect("api" in service).toBe(false);
  });
  it("returns null when the backend does not resolve a session", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue(null);
    const { em, service } = await createService(api);
    await expect(service.getCurrentAuthenticatedSession()).resolves.toBeNull();
    expect(em.findOne).not.toHaveBeenCalled();
  });
  it("sets a session-scoped signed cookie and expires cached auth data", async () => {
    const { service } = await createService();
    const appendHeader = vi.fn();
    const context = new RequestContext({ type: "http" });
    context.set(REQUEST, { headers: {} });
    context.set(RESPONSE, { appendHeader });
    await RequestContext.run(context, () =>
      service.setSessionCookie("session-token"),
    );
    expect(appendHeader).toHaveBeenCalledTimes(4);
    expect(appendHeader).toHaveBeenCalledWith("Set-Cookie", expect.any(String));
    const cookies = appendHeader.mock.calls.map(([, value]) => value as string);
    expect(cookies).toHaveLength(4);
    expect(cookies[0]).toMatch(
      /^better-auth\.session_token=session-token\.[^;]+; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect(cookies[0]).not.toContain("Max-Age");
    expect(cookies[1]).toMatch(
      /^better-auth\.dont_remember=true\.[^;]+; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect(cookies[2]).toContain("better-auth.session_data=; Max-Age=0");
    expect(cookies[3]).toContain("better-auth.account_data=; Max-Age=0");
  });
  it("expires every numbered cache-cookie chunk from the request", async () => {
    const { service } = await createService();
    const appendHeader = vi.fn();
    const context = new RequestContext({ type: "http" });
    context.set(REQUEST, {
      headers: {
        cookie: [
          "better-auth.session_data.0=first",
          "better-auth.session_data.1=second",
          "better-auth.session_data.01=invalid",
          "better-auth.account_data.0=account",
          "better-auth.account_data.other=invalid",
        ].join("; "),
      },
    });
    context.set(RESPONSE, { appendHeader });
    await RequestContext.run(context, () =>
      service.setSessionCookie("session-token"),
    );
    const responseCookies = appendHeader.mock.calls.map(
      ([, value]) => value as string,
    );
    expect(responseCookies).toHaveLength(7);
    expect(responseCookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_data=; Max-Age=0"),
        expect.stringContaining("better-auth.session_data.0=; Max-Age=0"),
        expect.stringContaining("better-auth.session_data.1=; Max-Age=0"),
        expect.stringContaining("better-auth.account_data=; Max-Age=0"),
        expect.stringContaining("better-auth.account_data.0=; Max-Age=0"),
      ]),
    );
    expect(responseCookies).not.toContainEqual(
      expect.stringContaining("better-auth.session_data.01="),
    );
    expect(responseCookies).not.toContainEqual(
      expect.stringContaining("better-auth.account_data.other="),
    );
  });
  it("tries the cookie session before an Authorization credential", async () => {
    requestHeaders.set("authorization", "Bearer api-key");
    const api = createApi();
    const user = Object.assign(new User(), { id: "user-1" });
    const session = Object.assign(new Session(), {
      token: "session-token",
    });
    api.getSession.mockResolvedValueOnce(null).mockResolvedValueOnce({
      session: { token: session.token },
      user: { id: user.id },
    });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(session),
    };
    const { service } = await createService(api, em);
    await expect(service.getCurrentAuthenticatedSession()).resolves.toEqual({
      session,
      user,
    });
    const cookieOnlyHeaders = api.getSession.mock.calls[0][0]
      .headers as Headers;
    expect(cookieOnlyHeaders.get("cookie")).toBe("session=value");
    expect(cookieOnlyHeaders.has("authorization")).toBe(false);
    expect(api.getSession.mock.calls[1][0]).toEqual({
      headers: requestHeaders,
    });
  });
  it("returns null when a persisted application entity no longer exists", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue({
      session: { token: "session-token" },
      user: { id: "user-1" },
    });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        token: "session-token",
      }),
    };
    const { service } = await createService(api, em);
    await expect(service.getCurrentAuthenticatedSession()).resolves.toBeNull();
  });
  it("rejects sessions belonging to an actively banned user", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue({
      session: { token: "session-token" },
      user: { id: "user-1" },
    });
    const user = Object.assign(new User(), {
      banned: true,
      banExpiresAt: null,
      id: "user-1",
    });
    const session = Object.assign(new Session(), {
      token: "session-token",
    });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(session),
    };
    const { service } = await createService(api, em);
    await expect(service.getCurrentAuthenticatedSession()).resolves.toBeNull();
  });
  it("lists active persisted sessions in backend order", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([
      { token: "session-2" },
      { token: "missing" },
      { token: "session-1" },
    ]);
    const session1 = Object.assign(new Session(), { token: "session-1" });
    const session2 = Object.assign(new Session(), { token: "session-2" });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn().mockResolvedValue([session1, session2]),
      findOne: vi.fn(),
    };
    const { service } = await createService(api, em);
    await expect(
      inSession(() => service.listCurrentUserSessions()),
    ).resolves.toEqual([session2, session1]);
    expect(em.find).toHaveBeenCalledWith(Session, {
      token: { $in: ["session-2", "missing", "session-1"] },
    });
  });
  it("uses its injected manager without changing the infrastructure's RLS context", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([{ token: "session-1" }]);
    const session = Object.assign(new Session(), { token: "session-1" });
    const em = {
      getContext: vi.fn().mockReturnThis(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(() => {
        expect(RequestContext.get(EntityManager)).not.toBe(em);
        expect(
          RequestContext.get(EntityManager)?.getSessionContext(),
        ).toBeUndefined();
        expect(em.getSessionContext()?.role).toBe("authenticated");
        return Promise.resolve([session]);
      }),
      findOne: vi.fn(),
    };
    const { service } = await createService(api, em);
    await RequestContext.run(
      new RequestContext({ type: "request" }),
      async () => {
        const sessionContext = mockRlsContext(em);
        RequestContext.set(EntityManager, em as unknown as EntityManager);
        RequestContext.set(
          Session,
          Object.assign(new Session(), { token: "current-token" }),
        );
        await expect(service.listCurrentUserSessions()).resolves.toEqual([
          session,
        ]);
        expect(em.getSessionContext()).toEqual(sessionContext);
        expect(em.fork).toHaveBeenCalledOnce();
      },
    );
  });
  it("does not query persistence for an empty session list", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([]);
    const { em, service } = await createService(api);
    await expect(
      inSession(() => service.listCurrentUserSessions()),
    ).resolves.toEqual([]);
    expect(em.find).not.toHaveBeenCalled();
  });
  it("revokes one session by public ID without exposing its token", async () => {
    const api = createApi();
    api.revokeSession.mockResolvedValue({ status: true });
    const { service } = await createService(api);
    const session = Object.assign(new Session(), {
      id: "session-1",
      token: "secret-session-token",
    });
    vi.spyOn(service, "listCurrentUserSessions").mockResolvedValue([session]);
    await expect(
      inSession(() => service.revokeCurrentUserSession("session-1")),
    ).resolves.toBe(true);
    expect(api.revokeSession).toHaveBeenCalledWith({
      body: { token: "secret-session-token" },
      headers: expect.any(Headers),
    });
  });
  it("does not revoke a session ID outside the authenticated user's sessions", async () => {
    const api = createApi();
    const { service } = await createService(api);
    vi.spyOn(service, "listCurrentUserSessions").mockResolvedValue([]);
    await expect(
      inSession(() => service.revokeCurrentUserSession("session-1")),
    ).resolves.toBe(false);
    expect(api.revokeSession).not.toHaveBeenCalled();
  });
  it.each(["one", "all"] as const)(
    "clears identity only after successful %s-session revocation",
    async (scope) => {
      const api = createApi();
      const em = {
        find: vi.fn(),
        findOne: vi.fn(),
        isInTransaction: vi.fn(() => false),
      };
      const { service } = await createService(api, em);
      const user = Object.assign(new User(), { id: "user-1" });
      const session = Object.assign(new Session(), {
        id: "session-1",
        user,
        token: "token",
      });
      vi.spyOn(service, "listCurrentUserSessions").mockResolvedValue([session]);
      const backend = scope === "one" ? api.revokeSession : api.revokeSessions;
      const revoke = () =>
        scope === "one"
          ? service.revokeCurrentUserSession(session.id)
          : service.revokeCurrentUserSessions();
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          RequestContext.set(Session, session);
          em.isInTransaction.mockReturnValue(true);
          await expect(revoke()).rejects.toThrow(
            "outside an active transaction",
          );
          expect(backend).not.toHaveBeenCalled();
          em.isInTransaction.mockReturnValue(false);
          backend.mockRejectedValueOnce(new Error("backend failed"));
          await expect(revoke()).rejects.toThrow("backend failed");
          expect(RequestContext.get(User)).toBe(user);
          backend.mockResolvedValueOnce({ status: false });
          await expect(revoke()).resolves.toBe(false);
          expect(RequestContext.get(Session)).toBe(session);
          backend.mockResolvedValueOnce({ status: true });
          await expect(revoke()).resolves.toBe(true);
          expect(RequestContext.get(User)).toBeNull();
          expect(RequestContext.get(Session)).toBeNull();
        },
      );
    },
  );
  it("preserves identity when revoking a different session", async () => {
    const api = createApi();
    api.revokeSession.mockResolvedValue({ status: true });
    const { service } = await createService(api);
    const session = Object.assign(new Session(), {
      id: "current",
      token: "current-token",
    });
    vi.spyOn(service, "listCurrentUserSessions").mockResolvedValue([
      Object.assign(new Session(), { id: "other", token: "other-token" }),
    ]);
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RequestContext.set(Session, session);
      await expect(service.revokeCurrentUserSession("other")).resolves.toBe(
        true,
      );
      expect(RequestContext.get(Session)).toBe(session);
    });
  });
  it("revokes every other session", async () => {
    const api = createApi();
    api.revokeOtherSessions.mockResolvedValue({ status: true });
    const { service } = await createService(api);
    await expect(
      inSession(() => service.revokeCurrentUserOtherSessions()),
    ).resolves.toBe(true);
    expect(api.revokeOtherSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });
  it("revokes every session", async () => {
    const api = createApi();
    api.revokeSessions.mockResolvedValue({ status: true });
    const { service } = await createService(api);
    await expect(
      inSession(() => service.revokeCurrentUserSessions()),
    ).resolves.toBe(true);
    expect(api.revokeSessions).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });
});

describe("session management", () => {
  describe("SessionService management", () => {
    it.each(["one", "all", "impersonator"] as const)(
      "rejects current %s revocation in an external transaction without RLS before writing",
      async (scope) => {
        const { em, service } = createService();
        const user = Object.assign(new User(), { id: "self" });
        const administrator = Object.assign(new User(), {
          id: "administrator",
        });
        const session = Object.assign(new Session(), {
          id: "current",
          user,
          impersonatedBy: scope === "impersonator" ? administrator : null,
        });
        em.isInTransaction.mockReturnValue(true);
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            RequestContext.set(User, user);
            RequestContext.set(Session, session);
            await expect(
              scope === "one"
                ? service.revokeSession(user, session.id)
                : service.revokeUserSessions(
                    scope === "impersonator" ? administrator : user,
                  ),
            ).rejects.toThrow(
              "Revoke the current session outside an active transaction",
            );
            expect(em.transactional).not.toHaveBeenCalled();
            expect(em.remove).not.toHaveBeenCalled();
            expect(em.nativeDelete).not.toHaveBeenCalled();
            expect(RequestContext.get(User)).toBe(user);
            expect(RequestContext.get(Session)).toBe(session);
          },
        );
      },
    );
    it.each(["one", "all", "impersonator"] as const)(
      "publishes administrative %s revocation only after a successful commit",
      async (scope) => {
        const { em, service } = createService();
        const user = Object.assign(new User(), { id: "self" });
        const target =
          scope === "impersonator"
            ? Object.assign(new User(), { id: "administrator" })
            : user;
        const session = Object.assign(new Session(), {
          id: "current",
          user,
          impersonatedBy: scope === "impersonator" ? target : null,
        });
        em.findOne.mockResolvedValue(session);
        em.find.mockResolvedValue([session]);
        const context = mockRlsContext(em);
        const revoke = () =>
          scope === "one"
            ? service.revokeSession(user, session.id)
            : service.revokeUserSessions(target);
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            RequestContext.set(User, user);
            RequestContext.set(Session, session);
            em.isInTransaction.mockReturnValue(true);
            await expect(revoke()).rejects.toThrow("active RLS transaction");
            expect(em.remove).not.toHaveBeenCalled();
            expect(em.nativeDelete).not.toHaveBeenCalled();
            em.isInTransaction.mockReturnValue(false);
            const persistence = scope === "one" ? em.flush : em.nativeDelete;
            persistence.mockRejectedValueOnce(new Error("Persistence failed"));
            await expect(revoke()).rejects.toThrow("Persistence failed");
            expect(RequestContext.get(User)).toBe(user);
            expect(RequestContext.get(Session)).toBe(session);
            expect(em.getSessionContext()).toEqual(context);
            expect(em.setSessionContext).not.toHaveBeenCalled();
            em.nativeDelete.mockResolvedValue(1);
            await revoke();
            expect(RequestContext.get(User)).toBeNull();
            expect(RequestContext.get(Session)).toBeNull();
            expect(em.setSessionContext).toHaveBeenCalledWith({
              role: "anonymous",
              variables: {
                "app.user.id": "",
                "app.workspace.id": "",
                "app.system_account.id": "",
                "app.member.id": "",
              },
            });
          },
        );
      },
    );
    it("authorizes administrative revocation before looking up the user", async () => {
      const { em, service, authorization } = createService();
      const user = Object.assign(new User(), { id: "target" });
      em.findOne.mockResolvedValue(user);
      em.find.mockResolvedValue([
        Object.assign(new Session(), { id: "one", user }),
        Object.assign(new Session(), { id: "two", user }),
      ]);
      em.nativeDelete.mockResolvedValue(2);
      await expect(service.revokeUserSessions(user.id)).resolves.toBe(2);
      expect(authorization.authorize).toHaveBeenCalledWith("revoke", Session);
      expect(authorization.authorize).not.toHaveBeenCalledWith("get", User);
      expect(em.findOne).toHaveBeenCalledWith(
        User,
        { id: user.id },
        { refresh: true },
      );
      authorization.authorize.mockImplementation(() => {
        throw new ForbiddenException();
      });
      em.findOne.mockClear();
      em.nativeDelete.mockClear();
      await expect(service.revokeUserSessions(user.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.revokeSession(user.id, "session")).rejects.toThrow(
        ForbiddenException,
      );
      expect(em.findOne).not.toHaveBeenCalled();
      expect(em.nativeDelete).not.toHaveBeenCalled();
    });
    it("rejects missing revocation targets without deleting any sessions", async () => {
      const { em, service } = createService();
      em.findOne.mockResolvedValue(null);
      await expect(service.revokeUserSessions("missing")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.revokeSession("missing", "session")).rejects.toThrow(
        NotFoundException,
      );
      expect(em.nativeDelete).not.toHaveBeenCalled();
      expect(em.remove).not.toHaveBeenCalled();
    });
    it("authorizes the impersonator profile separately from the parent session", async () => {
      const { em, service, authorization } = createService();
      const user = Object.assign(new User(), { id: "self" });
      const impersonator = Object.assign(new User(), { id: "admin" });
      const session = Object.assign(new Session(), {
        user: { id: user.id },
        impersonatedBy: impersonator,
      });
      const scope = mockRlsContext(em);
      em.findOne.mockResolvedValue(impersonator);
      await RequestContext.run(
        new RequestContext({ type: "test" }),
        async () => {
          RequestContext.set(User, user);
          await expect(service.getSessionImpersonator(session)).resolves.toBe(
            impersonator,
          );
          expect(em.findOne).toHaveBeenCalledWith(User, { id: "admin" });
          expect(authorization.authorize).toHaveBeenCalledWith("read", User);
          expect(authorization.authorize).toHaveBeenCalledWith(
            "read",
            impersonator,
          );
          authorization.authorize.mockImplementationOnce(() => {
            throw new ForbiddenException();
          });
          em.findOne.mockClear();
          await expect(service.getSessionImpersonator(session)).rejects.toThrow(
            ForbiddenException,
          );
          expect(em.findOne).not.toHaveBeenCalled();
          em.findOne.mockResolvedValue(null);
          await expect(
            service.getSessionImpersonator(session),
          ).resolves.toBeNull();
          em.findOne.mockClear();
          await expect(
            service.getSessionImpersonator(
              Object.assign(new Session(), { user: { id: user.id } }),
            ),
          ).resolves.toBeNull();
          expect(em.findOne).not.toHaveBeenCalled();
          RequestContext.set(API_KEY, new WorkspaceApiKey(new ApiKey()));
          authorization.authorize.mockImplementation(() => {
            throw new ForbiddenException();
          });
          await expect(service.getSessionImpersonator(session)).rejects.toThrow(
            ForbiddenException,
          );
          expect(em.findOne).not.toHaveBeenCalled();
        },
      );
      expect(em.fork).not.toHaveBeenCalled();
      expect(em.getSessionContext()).toEqual(scope);
    });
    it("paginates own sessions without admin permission, but checks delegated and foreign access", async () => {
      const { service, em, authorization } = createService();
      const user = Object.assign(new User(), { id: "self" });
      const context = mockRlsContext(em);
      const session = Object.assign(new Session(), {
        token: "already-hydrated-token",
        user,
      });
      const result = {
        edges: [{ cursor: "cursor", node: session }],
        pageInfo: {},
      };
      const find = vi
        .spyOn(ConnectionManager.prototype, "find")
        .mockResolvedValue(result as never);
      try {
        await RequestContext.run(
          new RequestContext({ type: "test" }),
          async () => {
            RequestContext.set(User, user);
            const connection = await service.getSessionConnectionByUser(user, {
              first: 2,
            });
            expect(connection.edges[0].node).not.toHaveProperty("token");
            expect(connection.edges[0].node).toBeInstanceOf(Session);
            expect(session.token).toBe("already-hydrated-token");
            expect(connection.pageInfo).toBe(result.pageInfo);
            expect(authorization.authorize).not.toHaveBeenCalled();
            expect(find).toHaveBeenCalledWith(
              SessionConnection,
              { first: 2 },
              {
                where: { user: "self", expiresAt: { $gt: expect.any(Date) } },
                exclude: ["token"],
              },
            );
            expect(em.fork).not.toHaveBeenCalled();
            expect(em.getSessionContext()).toEqual(context);
            vi.mocked(authorization.authorize).mockImplementation(() => {
              throw new ForbiddenException();
            });
            await expect(
              service.getSessionConnectionByUser(
                Object.assign(new User(), { id: "other" }),
                { first: 2 },
              ),
            ).rejects.toThrow(ForbiddenException);
            RequestContext.set(API_KEY, new WorkspaceApiKey(new ApiKey()));
            await expect(
              service.getSessionConnectionByUser(user, { first: 2 }),
            ).rejects.toThrow(ForbiddenException);
          },
        );
      } finally {
        find.mockRestore();
      }
    });
    it("revokes user sessions", async () => {
      const { em, service } = createService();
      const user = Object.assign(new User(), { id: "user-1" });
      const session = Object.assign(new Session(), {
        id: "session-1",
        token: "session-token",
        user,
      });
      em.findOne.mockResolvedValue(session);
      em.find.mockResolvedValue([
        session,
        Object.assign(new Session(), { id: "session-2", user }),
      ]);
      em.nativeDelete.mockResolvedValue(2);
      await expect(service.revokeSession(user, session.id)).resolves.toBe(true);
      em.findOne.mockResolvedValueOnce(null);
      await expect(service.revokeSession(user, "missing")).resolves.toBe(false);
      await expect(service.revokeUserSessions(user)).resolves.toBe(2);
      expect(em.findOne).toHaveBeenCalledWith(
        Session,
        { id: session.id, user: "user-1" },
        { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      expect(em.remove).toHaveBeenCalledWith(session);
      expect(em.find).toHaveBeenCalledWith(
        Session,
        {
          $or: [{ user: "user-1" }, { impersonatedBy: user }],
        },
        { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      expect(em.nativeDelete).toHaveBeenCalledWith(Session, {
        id: { $in: [session.id, "session-2"] },
      });
      em.find.mockResolvedValueOnce([]);
      em.nativeDelete.mockClear();
      await expect(service.revokeUserSessions(user)).resolves.toBe(0);
      expect(em.nativeDelete).not.toHaveBeenCalled();
    });
  });
  /**
   * Returns test service and its mocked dependencies.
   * @returns Test service and its mocked dependencies.
   */
  function createService() {
    const em = {
      getContext: vi.fn().mockReturnThis(),
      setSessionContext: vi.fn(),
      getSessionContext:
        vi.fn<() => import("@mikro-orm/core").SessionContext | undefined>(),
      isInTransaction: vi.fn(() => false),
      fork: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      flush: vi.fn(),
      nativeDelete: vi.fn(),
      remove: vi.fn(),
      transactional: vi.fn(),
    } as unknown as Mocked<EntityManager>;
    em.remove.mockReturnValue(em);
    em.transactional.mockImplementation(async (callback) => await callback(em));
    const authorization = mockAuthorization();
    return {
      em,
      authorization,
      service: new SessionService({}, em, createTestAuthContext(em, {})),
    };
  }
});

describe("conditional authorization", () => {
  describe("conditional service authorization", () => {
    it.each(
      (
        [
          "member",
          "user-invitation",
          "workspace-invitation",
          "user",
          "workspace",
          "session",
        ] as const
      ).filter((_row, index) => index === 5),
    )(
      "uses the ownership or instance-ability boundary for %s connections",
      async (kind) => {
        await withIdentity(
          async ({
            workspaceMemberService,
            workspaceInvitationService,
            workspaceService,
            userService,
            sessionService,
            user,
            workspace,
          }) => {
            const Entity =
              kind === "member"
                ? WorkspaceMember
                : kind === "user"
                  ? User
                  : kind === "workspace"
                    ? Workspace
                    : kind === "session"
                      ? Session
                      : WorkspaceInvitation;
            const node = Object.assign(new Entity(), { id: "allowed" });
            const result = {
              edges: [{ node, cursor: "cursor" }],
              pageInfo: { hasNextPage: true },
              totalCount: 2,
            };
            vi.spyOn(ConnectionManager.prototype, "find").mockResolvedValue(
              result as never,
            );
            const read = () =>
              kind === "member"
                ? workspaceMemberService.getWorkspaceMemberConnectionByWorkspace(
                    workspace,
                    {
                      first: 1,
                    },
                  )
                : kind === "user"
                  ? userService.getUserConnection({ first: 1 })
                  : kind === "workspace"
                    ? workspaceService.getWorkspaceConnectionByUser(user, {
                        first: 1,
                      })
                    : kind === "session"
                      ? sessionService.getSessionConnectionByUser(
                          Object.assign(new User(), { id: "other" }),
                          { first: 1 },
                        )
                      : kind === "user-invitation"
                        ? workspaceInvitationService.getWorkspaceInvitationConnectionByUser(
                            user,
                            {
                              first: 1,
                            },
                          )
                        : workspaceInvitationService.getWorkspaceInvitationConnectionByWorkspace(
                            workspace,
                            { first: 1 },
                          );
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
            node.id = "blocked";
            if (kind === "workspace") {
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
              expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
                expect.anything(),
                { first: 1 },
                expect.objectContaining({
                  where: expect.objectContaining({ id: expect.anything() }),
                }),
              );
            } else if (kind === "user-invitation") {
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
              expect(ConnectionManager.prototype.find).toHaveBeenLastCalledWith(
                expect.anything(),
                { first: 1 },
                expect.objectContaining({
                  where: expect.objectContaining({
                    email: user.email.toLowerCase(),
                    status: "pending",
                  }),
                }),
              );
            } else {
              await expect(read()).rejects.toThrow(ForbiddenException);
            }
            expect(result.edges).toHaveLength(1);
            expect(result.totalCount).toBe(2);
          },
        );
      },
    );
    it.each(["one", "all"] as const)(
      "checks every session before administrative %s revocation",
      async (scope) => {
        await withIdentity(async ({ em, user, sessionService }) => {
          const allowed = Object.assign(new Session(), { id: "allowed", user });
          const blocked = Object.assign(new Session(), { id: "blocked", user });
          em.findOne.mockResolvedValue(blocked);
          em.find.mockResolvedValue([allowed, blocked]);
          const revoke = () =>
            scope === "one"
              ? sessionService.revokeSession(user, blocked.id)
              : sessionService.revokeUserSessions(user);
          await expect(revoke()).rejects.toThrow(ForbiddenException);
          expect(em.nativeDelete).not.toHaveBeenCalled();
          expect(em.remove).not.toHaveBeenCalled();
          expect(em.flush).not.toHaveBeenCalled();
        });
      },
    );
  });
});
