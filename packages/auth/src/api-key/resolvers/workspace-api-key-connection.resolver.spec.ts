import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { Workspace } from "../../workspace/entities/workspace.entity.js";
import type { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { WorkspaceApiKeyConnectionResolver } from "./workspace-api-key-connection.resolver.js";

describe("WorkspaceApiKeyConnectionResolver", () => {
  it("preserves the selected workspace and ID, including hidden keys and authorization errors", async () => {
    const parent = new Workspace();
    const key = { id: "key" };
    const getWorkspaceApiKey = vi.fn().mockResolvedValue(key);
    const resolver = new WorkspaceApiKeyConnectionResolver({
      getWorkspaceApiKey,
    } as unknown as WorkspaceApiKeyService);
    await expect(resolver.apiKey(parent, "key")).resolves.toBe(key);
    expect(getWorkspaceApiKey).toHaveBeenCalledExactlyOnceWith("key", parent);
    getWorkspaceApiKey.mockResolvedValueOnce(null);
    await expect(resolver.apiKey(parent, "hidden")).resolves.toBeNull();
    getWorkspaceApiKey.mockRejectedValueOnce(new ForbiddenException());
    await expect(resolver.apiKey(parent, "denied")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it("forwards pagination and selection information without hiding service failures", async () => {
    const workspace = new Workspace();
    const args = { first: 10, after: "cursor" };
    const info = {
      fieldNodes: [],
      fragments: {},
      variableValues: {},
    } as unknown as GraphQLResolveInfo;
    const result = { edges: [], pageInfo: {} };
    const getWorkspaceApiKeyConnection = vi.fn().mockResolvedValue(result);
    const resolver = new WorkspaceApiKeyConnectionResolver({
      getWorkspaceApiKeyConnection,
    } as unknown as WorkspaceApiKeyService);
    await expect(
      resolver.workspaceApiKeys(workspace, args, info),
    ).resolves.toBe(result);
    expect(getWorkspaceApiKeyConnection).toHaveBeenCalledExactlyOnceWith(
      workspace,
      args,
      info,
    );
    getWorkspaceApiKeyConnection.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      resolver.workspaceApiKeys(workspace, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
