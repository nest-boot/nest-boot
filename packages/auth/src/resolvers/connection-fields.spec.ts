import { ForbiddenException } from "@nestjs/common";

import { User as BaseUser } from "../entities/user.entity.js";
import { Workspace as BaseWorkspace } from "../entities/workspace.entity.js";
import { type ApiKeyService } from "../services/api-key.service.js";
import { type MemberService } from "../services/member.service.js";
import { type UserService } from "../services/user.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { UserResolver } from "./user.resolver.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("connection field delegation", () => {
  it("passes parents and pagination arguments unchanged to services", async () => {
    const result = { edges: [], pageInfo: {} };
    const getWorkspaceConnectionByUser = vi.fn().mockResolvedValue(result);
    const getMemberConnectionByWorkspace = vi.fn().mockResolvedValue(result);
    const getApiKeyConnectionByUser = vi.fn().mockResolvedValue(result);
    const getApiKeyConnectionByWorkspace = vi.fn().mockResolvedValue(result);
    const workspaceService = {
      getWorkspaceConnectionByUser,
    } as unknown as WorkspaceService;
    const memberService = {
      getMemberConnectionByWorkspace,
    } as unknown as MemberService;
    const apiKeyService = {
      getApiKeyConnectionByUser,
      getApiKeyConnectionByWorkspace,
    } as unknown as ApiKeyService;
    const userResolver = new UserResolver(
      {} as UserService,
      workspaceService,
      apiKeyService,
      {} as never,
      {} as never,
      {} as never,
    );
    const workspaceResolver = new WorkspaceResolver(
      workspaceService,
      apiKeyService,
      memberService,
      {} as never,
    );
    const user = new BaseUser();
    const workspace = new BaseWorkspace();
    const args = { first: 10, after: "cursor" };

    await expect(userResolver.workspaces(user, args)).resolves.toBe(result);
    await expect(userResolver.apiKeys(user, args)).resolves.toBe(result);
    await expect(workspaceResolver.members(workspace, args)).resolves.toBe(
      result,
    );
    await expect(workspaceResolver.apiKeys(workspace, args)).resolves.toBe(
      result,
    );
    expect(getWorkspaceConnectionByUser).toHaveBeenCalledWith(user, args);
    expect(getApiKeyConnectionByUser).toHaveBeenCalledWith(user, args);
    expect(getMemberConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
    );
    expect(getApiKeyConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
    );

    for (const mock of [
      getWorkspaceConnectionByUser,
      getMemberConnectionByWorkspace,
      getApiKeyConnectionByUser,
      getApiKeyConnectionByWorkspace,
    ])
      mock.mockRejectedValue(new ForbiddenException());
    await expect(userResolver.workspaces(user, args)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(userResolver.apiKeys(user, args)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      workspaceResolver.members(workspace, args),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      workspaceResolver.apiKeys(workspace, args),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
