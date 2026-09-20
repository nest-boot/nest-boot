import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { User as BaseUser } from "../entities/user.entity.js";
import { Workspace as BaseWorkspace } from "../entities/workspace.entity.js";
import { type MemberService } from "../services/member.service.js";
import { type UserService } from "../services/user.service.js";
import type { UserApiKeyService } from "../services/user-api-key.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { type WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { UserResolver } from "./user.resolver.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("connection field delegation", () => {
  it("passes parents and pagination arguments unchanged to services", async () => {
    const result = { edges: [], pageInfo: {} };
    const getWorkspaceConnectionByUser = vi.fn().mockResolvedValue(result);
    const getMemberConnectionByWorkspace = vi.fn().mockResolvedValue(result);
    const getUserApiKeyConnection = vi.fn().mockResolvedValue(result);
    const getWorkspaceApiKeyConnection = vi.fn().mockResolvedValue(result);
    const workspaceService = {
      getWorkspaceConnectionByUser,
    } as unknown as WorkspaceService;
    const memberService = {
      getMemberConnectionByWorkspace,
    } as unknown as MemberService;
    const apiKeyService = {
      getUserApiKeyConnection,
      getWorkspaceApiKeyConnection,
    } as unknown as WorkspaceApiKeyService;
    const userResolver = new UserResolver(
      {} as UserService,
      workspaceService,
      apiKeyService as unknown as UserApiKeyService,
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
    const info = { fieldNodes: [] } as unknown as GraphQLResolveInfo;

    await expect(userResolver.workspaces(user, args, info)).resolves.toBe(
      result,
    );
    await expect(userResolver.apiKeys(user, args, info)).resolves.toBe(result);
    await expect(
      workspaceResolver.members(workspace, args, info),
    ).resolves.toBe(result);
    await expect(
      workspaceResolver.apiKeys(workspace, args, info),
    ).resolves.toBe(result);
    expect(getWorkspaceConnectionByUser).toHaveBeenCalledWith(user, args, info);
    expect(getUserApiKeyConnection).toHaveBeenCalledWith(user, args, info);
    expect(getMemberConnectionByWorkspace).toHaveBeenCalledWith(
      workspace,
      args,
      info,
    );
    expect(getWorkspaceApiKeyConnection).toHaveBeenCalledWith(
      workspace,
      args,
      info,
    );

    for (const mock of [
      getWorkspaceConnectionByUser,
      getMemberConnectionByWorkspace,
      getUserApiKeyConnection,
      getWorkspaceApiKeyConnection,
    ])
      mock.mockRejectedValue(new ForbiddenException());
    await expect(
      userResolver.workspaces(user, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(userResolver.apiKeys(user, args, info)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      workspaceResolver.members(workspace, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      workspaceResolver.apiKeys(workspace, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
