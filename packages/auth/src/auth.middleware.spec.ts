import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";
import { NextFunction, Request } from "express";
import type { Mock } from "vitest";

import { ApiKeyService } from "./api-key.service.js";
import {
  CURRENT_API_KEY,
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import { AuthService } from "./auth.service.js";
import { BaseSession, BaseUser } from "./entities/index.js";

class TestUser extends BaseUser {}
class TestSession extends BaseSession {}

async function createMiddleware(
  getSession: Mock,
  findOne: Mock,
  onAuthenticated = vi.fn(),
  validate = vi.fn(),
) {
  const authService = {
    api: {
      getSession,
    },
  } as unknown as AuthService;
  const em = {
    findOne,
  } as unknown as EntityManager;
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthMiddleware,
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          entities: {
            account: class {},
            apiKey: class {},
            session: TestSession,
            user: TestUser,
            verification: class {},
            workspace: class {},
            workspaceMember: class {},
          },
          onAuthenticated,
        },
      },
      {
        provide: AuthService,
        useValue: authService,
      },
      {
        provide: ApiKeyService,
        useValue: { validate },
      },
      {
        provide: EntityManager,
        useValue: em,
      },
    ],
  }).compile();

  return {
    middleware: moduleRef.get(AuthMiddleware),
    onAuthenticated,
    validate,
  };
}

describe("AuthMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should continue without context when no session is returned", async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn();
    const next = vi.fn() as NextFunction;
    const { middleware } = await createMiddleware(getSession, findOne);

    await middleware.use(
      {
        headers: {
          "x-empty": undefined,
          "x-test": ["a", "b"],
        },
      } as unknown as Request,
      {} as never,
      next,
    );

    const headers = getSession.mock.calls[0][0].headers as Headers;
    expect(headers.get("x-test")).toBe("a, b");
    expect(findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should store authenticated user and session in request context", async () => {
    const user = {
      id: "user-1",
    };
    const session = {
      token: "session-token",
    };
    const getSession = vi.fn().mockResolvedValue({
      session,
      user,
    });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(session);
    const requestContextSet = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;
    const { middleware, onAuthenticated } = await createMiddleware(
      getSession,
      findOne,
    );

    await middleware.use(
      {
        headers: {
          authorization: "Bearer token",
        },
      } as unknown as Request,
      {} as never,
      next,
    );

    expect(findOne).toHaveBeenCalledWith(TestUser, {
      id: "user-1",
    });
    expect(findOne).toHaveBeenCalledWith(TestSession, {
      token: "session-token",
    });
    expect(requestContextSet).toHaveBeenCalledWith(BaseUser, user);
    expect(requestContextSet).toHaveBeenCalledWith(BaseSession, session);
    expect(requestContextSet).toHaveBeenCalledWith(TestUser, user);
    expect(requestContextSet).toHaveBeenCalledWith(TestSession, session);
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should not store context when user or session cannot be loaded", async () => {
    const getSession = vi.fn().mockResolvedValue({
      session: {
        token: "session-token",
      },
      user: {
        id: "user-1",
      },
    });
    const findOne = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      token: "session-token",
    });
    const requestContextSet = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;
    const { middleware, onAuthenticated } = await createMiddleware(
      getSession,
      findOne,
    );

    await middleware.use({ headers: {} } as Request, {} as never, next);

    expect(requestContextSet).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("gives a valid session precedence over a Bearer API key", async () => {
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
    });
    const getSession = vi.fn().mockResolvedValue({ session, user });
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(session);
    const validate = vi.fn();
    const { middleware } = await createMiddleware(
      getSession,
      findOne,
      vi.fn(),
      validate,
    );

    await middleware.use(
      { headers: { authorization: "Bearer sk-key" } } as Request,
      {} as never,
      vi.fn(),
    );

    expect(validate).not.toHaveBeenCalled();
  });

  it("restores a user key and resolves membership in the selected workspace", async () => {
    class TestWorkspace {}
    class TestWorkspaceMember {}
    const workspace = Object.assign(new TestWorkspace(), {
      id: "workspace-1",
      name: "Acme",
    });
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const member = Object.assign(new TestWorkspaceMember(), {
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
      vi.fn(),
      validate,
    );
    const set = vi.spyOn(RequestContext, "set");

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await middleware.use(
        {
          headers: {
            authorization: "Bearer sk-key",
            "x-workspace-id": "workspace-1",
          },
        } as Request,
        {} as never,
        vi.fn(),
      );
    });

    expect(validate).toHaveBeenCalledWith("sk-key");
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE, workspace);
    expect(set).toHaveBeenCalledWith(CURRENT_API_KEY, apiKey);
    expect(set).toHaveBeenCalledWith(BaseUser, user);
    expect(findOne).toHaveBeenLastCalledWith(expect.any(Function), {
      user,
      workspace,
    });
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE_MEMBER, member);
  });

  it("restores a workspace key and rejects a conflicting workspace selector", async () => {
    class TestWorkspace {}
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
      vi.fn(),
      validate,
    );
    const next = vi.fn();

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      await middleware.use(
        {
          headers: {
            authorization: "Bearer sk-key",
            "x-workspace-id": "workspace-1",
          },
        } as Request,
        {} as never,
        next,
      );
    });

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});
