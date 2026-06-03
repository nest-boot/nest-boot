import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { NextFunction, Request } from "express";

import { AuthMiddleware } from "./auth.middleware";
import { AuthService } from "./auth.service";
import { BaseSession, BaseUser } from "./entities";

class TestUser extends BaseUser {}
class TestSession extends BaseSession {}

function createMiddleware(
  getSession: jest.Mock,
  findOne: jest.Mock,
  onAuthenticated = jest.fn(),
) {
  const authService = {
    api: {
      getSession,
    },
  } as unknown as AuthService;
  const em = {
    findOne,
  } as unknown as EntityManager;

  return {
    middleware: new AuthMiddleware(
      {
        entities: {
          account: class {},
          session: TestSession,
          user: TestUser,
          verification: class {},
        },
        onAuthenticated,
      } as never,
      authService,
      em,
    ),
    onAuthenticated,
  };
}

describe("AuthMiddleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should continue without context when no session is returned", async () => {
    const getSession = jest.fn().mockResolvedValue(null);
    const findOne = jest.fn();
    const next = jest.fn() as NextFunction;
    const { middleware } = createMiddleware(getSession, findOne);

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
    const getSession = jest.fn().mockResolvedValue({
      session,
      user,
    });
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(session);
    const requestContextSet = jest
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = jest.fn() as NextFunction;
    const { middleware, onAuthenticated } = createMiddleware(
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
    const getSession = jest.fn().mockResolvedValue({
      session: {
        token: "session-token",
      },
      user: {
        id: "user-1",
      },
    });
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        token: "session-token",
      });
    const requestContextSet = jest
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = jest.fn() as NextFunction;
    const { middleware, onAuthenticated } = createMiddleware(
      getSession,
      findOne,
    );

    await middleware.use({ headers: {} } as Request, {} as never, next);

    expect(requestContextSet).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
