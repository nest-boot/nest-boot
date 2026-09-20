import { EntityManager } from "@mikro-orm/core";
import { REQUEST, RequestContext, RESPONSE } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";

import { mockRlsContext } from "../../test/mock-rls-context.js";
import { AUTH_TOKEN } from "../auth.constants.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { AccessControlService } from "./access-control.service.js";
import { SessionService } from "./session.service.js";

const requestHeaders = vi.hoisted(
  () => new Headers({ cookie: "session=value" }),
);

vi.mock("@nest-boot/request-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nest-boot/request-context")>()),
  headers: () => requestHeaders,
}));

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

async function createService(
  api = createApi(),
  em: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> } = {
    find: vi.fn(),
    findOne: vi.fn(),
  },
) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SessionService,
      { provide: AccessControlService, useValue: { assertCan: vi.fn() } },
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

describe("SessionService", () => {
  beforeEach(() => {
    requestHeaders.delete("authorization");
    requestHeaders.set("cookie", "session=value");
  });

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

    await expect(service.listCurrentUserSessions()).resolves.toEqual([
      session2,
      session1,
    ]);
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
        expect(RequestContext.get(EntityManager)).toBe(em);
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
        await expect(service.listCurrentUserSessions()).resolves.toEqual([
          session,
        ]);
        expect(em.getSessionContext()).toEqual(sessionContext);
        expect(em.fork).not.toHaveBeenCalled();
      },
    );
  });

  it("does not query persistence for an empty session list", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([]);
    const { em, service } = await createService(api);

    await expect(service.listCurrentUserSessions()).resolves.toEqual([]);
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

    await expect(service.revokeCurrentUserSession("session-1")).resolves.toBe(
      true,
    );
    expect(api.revokeSession).toHaveBeenCalledWith({
      body: { token: "secret-session-token" },
      headers: requestHeaders,
    });
  });

  it("does not revoke a session ID outside the authenticated user's sessions", async () => {
    const api = createApi();
    const { service } = await createService(api);
    vi.spyOn(service, "listCurrentUserSessions").mockResolvedValue([]);

    await expect(service.revokeCurrentUserSession("session-1")).resolves.toBe(
      false,
    );
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
    const session = Object.assign(new Session(), { id: "current" });
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

    await expect(service.revokeCurrentUserOtherSessions()).resolves.toBe(true);
    expect(api.revokeOtherSessions).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
  });

  it("revokes every session", async () => {
    const api = createApi();
    api.revokeSessions.mockResolvedValue({ status: true });
    const { service } = await createService(api);

    await expect(service.revokeCurrentUserSessions()).resolves.toBe(true);
    expect(api.revokeSessions).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
  });
});
