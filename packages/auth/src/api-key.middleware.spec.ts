/* eslint-disable @typescript-eslint/unbound-method */
import { RequestContext } from "@nest-boot/request-context";
import type { NextFunction, Request } from "express";
import type { Mocked } from "vitest";

import { ApiKeyMiddleware } from "./api-key.middleware.js";
import type { ApiKeyService } from "./api-key.service.js";
import {
  CURRENT_API_KEY,
  CURRENT_WORKSPACE,
  CURRENT_WORKSPACE_MEMBER,
} from "./auth.constants.js";
import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import { BaseSession } from "./entities/session.entity.js";
import type {
  AuthApiKeyEntity,
  AuthWorkspaceEntity,
  AuthWorkspaceMemberEntity,
} from "./interfaces/auth-entities.interface.js";

class TestApiKey {}
class TestWorkspace {}
class TestWorkspaceMember {}

describe("ApiKeyMiddleware", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives an authenticated session precedence over a Bearer API key", async () => {
    const { apiKeyService, middleware } = createMiddleware();
    vi.spyOn(RequestContext, "get").mockImplementation((token) =>
      token === BaseSession ? new BaseSession() : undefined,
    );
    const next = vi.fn() as NextFunction;

    await middleware.use(bearerRequest("sk-key"), {} as never, next);

    expect(apiKeyService.validate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("validates a Bearer API key when there is no session", async () => {
    const apiKey = { id: "api-key-1" } as AuthApiKeyEntity;
    const workspace = {
      id: "workspace-1",
      name: "Acme",
    } as AuthWorkspaceEntity;
    const workspaceMember = {
      id: "member-1",
    } as AuthWorkspaceMemberEntity;
    const { apiKeyService, middleware } = createMiddleware({
      apiKey,
      workspace,
      workspaceMember,
    });
    vi.spyOn(RequestContext, "get").mockReturnValue(undefined);
    const set = vi
      .spyOn(RequestContext, "set")
      .mockImplementation(() => undefined);
    const next = vi.fn() as NextFunction;

    await middleware.use(bearerRequest("sk-key"), {} as never, next);

    expect(apiKeyService.validate).toHaveBeenCalledWith("sk-key");
    expect(set).toHaveBeenCalledWith(CURRENT_API_KEY, apiKey);
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE, workspace);
    expect(set).toHaveBeenCalledWith(CURRENT_WORKSPACE_MEMBER, workspaceMember);
    expect(set).toHaveBeenCalledWith(TestApiKey, apiKey);
    expect(set).toHaveBeenCalledWith(TestWorkspace, workspace);
    expect(set).toHaveBeenCalledWith(TestWorkspaceMember, workspaceMember);
    expect(next).toHaveBeenCalledWith();
  });

  it("ignores x-api-key and forwards Bearer validation errors", async () => {
    const error = new Error("invalid key");
    const { apiKeyService, middleware } = createMiddleware();
    apiKeyService.validate.mockRejectedValue(error);
    vi.spyOn(RequestContext, "get").mockReturnValue(undefined);
    const next = vi.fn() as NextFunction;

    await middleware.use(
      { headers: { "x-api-key": "sk-key" } } as unknown as Request,
      {} as never,
      next,
    );
    expect(apiKeyService.validate).not.toHaveBeenCalled();

    await middleware.use(bearerRequest("sk-key"), {} as never, next);
    expect(next).toHaveBeenLastCalledWith(error);
  });
});

function createMiddleware(validation?: {
  apiKey: AuthApiKeyEntity;
  workspace: AuthWorkspaceEntity;
  workspaceMember: AuthWorkspaceMemberEntity;
}) {
  const apiKeyService = {
    validate: vi.fn(() => Promise.resolve(validation)),
  } as unknown as Mocked<ApiKeyService>;
  const options = {
    entities: {
      apiKey: TestApiKey,
      workspace: TestWorkspace,
      workspaceMember: TestWorkspaceMember,
    },
  } as unknown as AuthModuleOptions;

  return {
    apiKeyService,
    middleware: new ApiKeyMiddleware(apiKeyService, options),
  };
}

function bearerRequest(apiKey: string): Request {
  return {
    headers: { authorization: `Bearer ${apiKey}` },
  } as Request;
}
