/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import type { NextFunction, Request } from "express";
import type { Mocked } from "vitest";

import { CURRENT_WORKSPACE } from "./auth.constants.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthWorkspaceEntity } from "./interfaces/auth-entities.interface.js";
import { WorkspaceMiddleware } from "./workspace.middleware.js";

class TestWorkspace implements AuthWorkspaceEntity {
  id = "workspace-1";
  name = "Acme";
}

describe("WorkspaceMiddleware", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{ headers: { "x-workspace-id": " workspace-1 " } }, "workspace-1"],
    [{ cookies: { workspace_id: "workspace-2" }, headers: {} }, "workspace-2"],
  ])("loads a selected workspace", async (request, workspaceId) => {
    const workspace = new TestWorkspace();
    const { em, middleware } = createMiddleware(workspace);
    const set = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;

    await middleware.use(request as Request, {} as never, next);

    expect(em.findOne).toHaveBeenCalledWith(TestWorkspace, {
      deletedAt: null,
      id: workspaceId,
    });
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE, workspace);
    expect(set).toHaveBeenCalledWith(TestWorkspace, workspace);
    expect(next).toHaveBeenCalledWith();
  });

  it("does not query when no workspace is selected", async () => {
    const { em, middleware } = createMiddleware(null);
    const next = vi.fn() as NextFunction;

    await middleware.use({ headers: {} } as Request, {} as never, next);

    expect(em.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("forwards lookup errors", async () => {
    const error = new Error("lookup failed");
    const { em, middleware } = createMiddleware(null);
    em.findOne.mockRejectedValue(error);
    const next = vi.fn() as NextFunction;

    await middleware.use(
      { headers: { "x-workspace-id": "workspace-1" } } as Request,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});

function createMiddleware(workspace: TestWorkspace | null) {
  const em = {
    findOne: vi.fn(() => Promise.resolve(workspace)),
  } as unknown as Mocked<EntityManager>;
  const options = {
    entities: { workspace: TestWorkspace },
  } as unknown as AuthModuleOptions;

  return {
    em,
    middleware: new WorkspaceMiddleware(em, options),
  };
}
