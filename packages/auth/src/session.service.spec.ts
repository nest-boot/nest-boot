import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "@nest-boot/row-level-security";
import { Test } from "@nestjs/testing";

import { AUTH_TOKEN } from "./auth.constants.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseSession, BaseUser } from "./entities/index.js";
import { SessionService } from "./session.service.js";

class TestSession extends BaseSession {}
class TestUser extends BaseUser {}

function createApi() {
  return {
    getSession: vi.fn(),
    listSessions: vi.fn(),
    revokeOtherSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeSessions: vi.fn(),
  };
}

async function createService(
  api = createApi(),
  em: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> } = {
    find: vi.fn(),
    findOne: vi.fn(),
  },
) {
  const options = {
    entities: {
      session: TestSession,
      user: TestUser,
    },
  } as unknown as AuthModuleOptions;
  const moduleRef = await Test.createTestingModule({
    providers: [
      SessionService,
      {
        provide: AUTH_TOKEN,
        useValue: { api },
      },
      {
        provide: EntityManager,
        useValue: em,
      },
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: options,
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
  const headers = new Headers({ cookie: "session=value" });

  it("resolves configured application user and session entities", async () => {
    const api = createApi();
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
    });
    api.getSession.mockResolvedValue({
      session: { token: session.token },
      user: { id: user.id },
    });
    const em = {
      find: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(session),
    };
    const { service } = await createService(api, em);

    await expect(service.getSession(headers)).resolves.toEqual({
      session,
      user,
    });
    expect(api.getSession).toHaveBeenCalledWith({ headers });
    expect(em.findOne).toHaveBeenNthCalledWith(1, TestUser, { id: "user-1" });
    expect(em.findOne).toHaveBeenNthCalledWith(2, TestSession, {
      token: "session-token",
    });
    expect("api" in service).toBe(false);
  });

  it("returns null when the backend does not resolve a session", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue(null);
    const { em, service } = await createService(api);

    await expect(service.getSession(headers)).resolves.toBeNull();
    expect(em.findOne).not.toHaveBeenCalled();
  });

  it("returns null when a persisted application entity no longer exists", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue({
      session: { token: "session-token" },
      user: { id: "user-1" },
    });
    const em = {
      find: vi.fn(),
      findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        token: "session-token",
      }),
    };
    const { service } = await createService(api, em);

    await expect(service.getSession(headers)).resolves.toBeNull();
  });

  it("rejects sessions belonging to an actively banned user", async () => {
    const api = createApi();
    api.getSession.mockResolvedValue({
      session: { token: "session-token" },
      user: { id: "user-1" },
    });
    const user = Object.assign(new TestUser(), {
      banned: true,
      banExpiresAt: null,
      id: "user-1",
    });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
    });
    const em = {
      find: vi.fn(),
      findOne: vi
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(session),
    };
    const { service } = await createService(api, em);

    await expect(service.getSession(headers)).resolves.toBeNull();
  });

  it("lists active persisted sessions in backend order", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([
      { token: "session-2" },
      { token: "missing" },
      { token: "session-1" },
    ]);
    const session1 = Object.assign(new TestSession(), { token: "session-1" });
    const session2 = Object.assign(new TestSession(), { token: "session-2" });
    const em = {
      find: vi.fn().mockResolvedValue([session1, session2]),
      findOne: vi.fn(),
    };
    const { service } = await createService(api, em);

    await expect(service.listSessions(headers)).resolves.toEqual([
      session2,
      session1,
    ]);
    expect(em.find).toHaveBeenCalledWith(TestSession, {
      token: { $in: ["session-2", "missing", "session-1"] },
    });
  });

  it("resolves session entities outside the application RLS role", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([{ token: "session-1" }]);
    const session = Object.assign(new TestSession(), { token: "session-1" });
    const em = {
      find: vi.fn(() => {
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.DISABLED);
        return Promise.resolve([session]);
      }),
      findOne: vi.fn(),
    };
    const { service } = await createService(api, em);

    await RequestContext.run(
      new RequestContext({ type: "request" }),
      async () => {
        RowLevelSecurity.setRole("authenticated");
        await expect(service.listSessions(headers)).resolves.toEqual([session]);
        expect(RowLevelSecurity.getMode()).toBe(RowLevelSecurityMode.AUTO);
        expect(RowLevelSecurity.getRole()).toBe("authenticated");
      },
    );
  });

  it("does not query persistence for an empty session list", async () => {
    const api = createApi();
    api.listSessions.mockResolvedValue([]);
    const { em, service } = await createService(api);

    await expect(service.listSessions(headers)).resolves.toEqual([]);
    expect(em.find).not.toHaveBeenCalled();
  });

  it("revokes one session", async () => {
    const api = createApi();
    api.revokeSession.mockResolvedValue({ status: true });
    const { service } = await createService(api);

    await expect(service.revokeSession(headers, "session-1")).resolves.toBe(
      true,
    );
    expect(api.revokeSession).toHaveBeenCalledWith({
      body: { token: "session-1" },
      headers,
    });
  });

  it("revokes every other session", async () => {
    const api = createApi();
    api.revokeOtherSessions.mockResolvedValue({ status: true });
    const { service } = await createService(api);

    await expect(service.revokeOtherSessions(headers)).resolves.toBe(true);
    expect(api.revokeOtherSessions).toHaveBeenCalledWith({ headers });
  });

  it("revokes every session", async () => {
    const api = createApi();
    api.revokeSessions.mockResolvedValue({ status: true });
    const { service } = await createService(api);

    await expect(service.revokeSessions(headers)).resolves.toBe(true);
    expect(api.revokeSessions).toHaveBeenCalledWith({ headers });
  });
});
