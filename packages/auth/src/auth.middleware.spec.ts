import { EntityManager } from "@mikro-orm/core";
import { REQUEST, RequestContext } from "@nest-boot/request-context";
import { Test } from "@nestjs/testing";
import { NextFunction, Request } from "express";
import type { Mock } from "vitest";

import { ApiKeyService } from "./api-key.service.js";
import { AuthMiddleware } from "./auth.middleware.js";
import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import {
  BaseAccount,
  BaseApiKey,
  BaseSession,
  BaseUser,
  BaseVerification,
  BaseWorkspace,
  BaseWorkspaceInvitation,
  BaseWorkspaceMember,
} from "./entities/index.js";
import { SessionService } from "./session.service.js";

class TestAccount extends BaseAccount {}
class TestApiKey extends BaseApiKey {}
class TestUser extends BaseUser {}
class TestSession extends BaseSession {}
class TestVerification extends BaseVerification {}
class TestWorkspace extends BaseWorkspace {}
class TestWorkspaceInvitation extends BaseWorkspaceInvitation {}
class TestWorkspaceMember extends BaseWorkspaceMember {}

const testEntities = {
  account: TestAccount,
  apiKey: TestApiKey,
  session: TestSession,
  user: TestUser,
  verification: TestVerification,
  workspace: TestWorkspace,
  workspaceInvitation: TestWorkspaceInvitation,
  workspaceMember: TestWorkspaceMember,
};

async function createMiddleware(
  getSession: Mock,
  findOne: Mock,
  validate = vi.fn(),
  entities: AuthModuleOptions["entities"] = testEntities,
) {
  const sessionService = {
    getSession,
  } as unknown as SessionService;
  const em = {
    findOne,
  } as unknown as EntityManager;
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthMiddleware,
      {
        provide: MODULE_OPTIONS_TOKEN,
        useValue: {
          entities,
        },
      },
      {
        provide: SessionService,
        useValue: sessionService,
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should continue without context when no session is returned", async () => {
    const getSession = vi.fn().mockResolvedValue(null);
    const findOne = vi.fn();
    const next = vi.fn() as NextFunction;
    const { middleware } = await createMiddleware(getSession, findOne);
    const request = {
      headers: {
        "x-empty": undefined,
        "x-test": ["a", "b"],
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);
    });

    expect(getSession).toHaveBeenCalledWith();
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
        apiKey: BaseApiKey,
        session: BaseSession,
        user: BaseUser,
        verification: BaseVerification,
        workspace: BaseWorkspace,
        workspaceInvitation: BaseWorkspaceInvitation,
        workspaceMember: BaseWorkspaceMember,
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
    const getSession = vi.fn().mockResolvedValue({
      session,
      user,
    });
    const findOne = vi.fn();
    const requestContextSet = vi.spyOn(RequestContext, "set");
    const requestContextAlias = vi.spyOn(RequestContext, "alias");
    const next = vi.fn() as NextFunction;
    const { middleware } = await createMiddleware(getSession, findOne);
    const request = {
      headers: {
        authorization: "Bearer token",
      },
    } as unknown as Request;

    await runInRequestContext(request, async () => {
      await middleware.use(request, {} as never, next);

      expect(RequestContext.get(BaseUser)).toBe(user);
      expect(RequestContext.get(TestUser)).toBe(user);
      expect(RequestContext.get(BaseSession)).toBe(session);
      expect(RequestContext.get(TestSession)).toBe(session);
    });

    expect(findOne).not.toHaveBeenCalled();
    expect(requestContextSet).toHaveBeenCalledWith(BaseUser, user);
    expect(requestContextSet).toHaveBeenCalledWith(BaseSession, session);
    expect(requestContextAlias).toHaveBeenCalledWith(TestAccount, BaseAccount);
    expect(requestContextAlias).toHaveBeenCalledWith(TestApiKey, BaseApiKey);
    expect(requestContextAlias).toHaveBeenCalledWith(TestUser, BaseUser);
    expect(requestContextAlias).toHaveBeenCalledWith(TestSession, BaseSession);
    expect(requestContextAlias).toHaveBeenCalledWith(
      TestVerification,
      BaseVerification,
    );
    expect(requestContextAlias).toHaveBeenCalledWith(
      TestWorkspace,
      BaseWorkspace,
    );
    expect(requestContextAlias).toHaveBeenCalledWith(
      TestWorkspaceInvitation,
      BaseWorkspaceInvitation,
    );
    expect(requestContextAlias).toHaveBeenCalledWith(
      TestWorkspaceMember,
      BaseWorkspaceMember,
    );
    expect(requestContextSet).not.toHaveBeenCalledWith(TestUser, user);
    expect(requestContextSet).not.toHaveBeenCalledWith(TestSession, session);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("gives a valid session precedence over a Bearer API key", async () => {
    const user = Object.assign(new TestUser(), { id: "user-1" });
    const session = Object.assign(new TestSession(), {
      token: "session-token",
    });
    const getSession = vi.fn().mockResolvedValue({ session, user });
    const findOne = vi.fn();
    const validate = vi.fn();
    const { middleware } = await createMiddleware(
      getSession,
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

      expect(RequestContext.get(TestWorkspace)).toBe(workspace);
      expect(RequestContext.get(TestApiKey)).toBe(apiKey);
      expect(RequestContext.get(TestUser)).toBe(user);
      expect(RequestContext.get(TestWorkspaceMember)).toBe(member);
    });

    expect(validate).toHaveBeenCalledWith("sk-key");
    expect(set).toHaveBeenCalledWith(BaseWorkspace, workspace);
    expect(set).toHaveBeenCalledWith(BaseApiKey, apiKey);
    expect(set).toHaveBeenCalledWith(BaseUser, user);
    expect(findOne).toHaveBeenLastCalledWith(expect.any(Function), {
      status: "ACTIVE",
      user,
      workspace,
    });
    expect(set).toHaveBeenCalledWith(BaseWorkspaceMember, member);
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
    expect(set).not.toHaveBeenCalledWith(
      BaseWorkspaceMember,
      expect.anything(),
    );
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

    expect(findOne).toHaveBeenCalledWith(TestWorkspace, {
      deletedAt: null,
      id: "workspace-1",
    });
  });
});
