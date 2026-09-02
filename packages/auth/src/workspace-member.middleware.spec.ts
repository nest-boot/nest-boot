/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import type { NextFunction, Request } from "express";
import type { Mocked } from "vitest";

import {
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseUser } from "./entities/user.entity.js";
import type { AuthWorkspaceMemberEntity } from "./interfaces/auth-entities.interface.js";
import { WorkspaceMemberMiddleware } from "./workspace-member.middleware.js";

class TestWorkspaceMember implements AuthWorkspaceMemberEntity {
  id = "member-1";
  name = "Alice";
  role = "MEMBER" as const;
  status = "ACTIVE" as const;
  workspace = {} as AuthWorkspaceMemberEntity["workspace"];
}

describe("WorkspaceMemberMiddleware", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the identity already restored by an API key", async () => {
    const { em, middleware } = createMiddleware();
    const get = vi
      .spyOn(RequestContext, "get")
      .mockImplementation((token) =>
        token === CURRENT_WORKSPACE_MEMBER
          ? new TestWorkspaceMember()
          : undefined,
      );
    const next = vi.fn() as NextFunction;

    await middleware.use({} as Request, {} as never, next);

    expect(get).toHaveBeenCalledWith(CURRENT_WORKSPACE_MEMBER);
    expect(em.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("loads and stores the session user's selected-workspace membership", async () => {
    const user = Object.assign(new BaseUser(), { id: "user-1" });
    const workspace = { id: "workspace-1", name: "Acme" };
    const member = new TestWorkspaceMember();
    const { em, middleware } = createMiddleware(member);
    vi.spyOn(RequestContext, "get").mockImplementation((token) => {
      if (token === BaseUser) return user;
      if (token === CURRENT_WORKSPACE) return workspace;
      return undefined;
    });
    const set = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;

    await middleware.use({} as Request, {} as never, next);

    expect(em.findOne).toHaveBeenCalledWith(TestWorkspaceMember, {
      user,
      workspace,
    });
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE_MEMBER, member);
    expect(set).toHaveBeenCalledWith(TestWorkspaceMember, member);
    expect(next).toHaveBeenCalledWith();
  });

  it("does nothing without both a session user and selected workspace", async () => {
    const { em, middleware } = createMiddleware();
    vi.spyOn(RequestContext, "get").mockReturnValue(undefined);
    const next = vi.fn() as NextFunction;

    await middleware.use({} as Request, {} as never, next);

    expect(em.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});

function createMiddleware(member: TestWorkspaceMember | null = null) {
  const em = {
    findOne: vi.fn(() => Promise.resolve(member)),
  } as unknown as Mocked<EntityManager>;
  const options = {
    entities: { workspaceMember: TestWorkspaceMember },
  } as unknown as AuthModuleOptions;

  return {
    em,
    middleware: new WorkspaceMemberMiddleware(em, options),
  };
}
