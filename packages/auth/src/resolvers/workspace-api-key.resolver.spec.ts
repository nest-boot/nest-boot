import { ForbiddenException } from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { Workspace } from "../entities/workspace.entity.js";
import type { WorkspaceApiKeyService } from "../services/workspace-api-key.service.js";
import { WorkspaceApiKeyResolver } from "./workspace-api-key.resolver.js";

describe("WorkspaceApiKeyResolver", () => {
  it("preserves the selected workspace and ID, including hidden keys and authorization errors", async () => {
    const parent = new Workspace();
    const key = { id: "key" };
    const getMemberApiKey = vi.fn().mockResolvedValue(key);
    const resolver = new WorkspaceApiKeyResolver({
      getMemberApiKey,
    } as unknown as WorkspaceApiKeyService);
    await expect(resolver.apiKey(parent, "key")).resolves.toBe(key);
    expect(getMemberApiKey).toHaveBeenCalledExactlyOnceWith("key", parent);
    getMemberApiKey.mockResolvedValueOnce(null);
    await expect(resolver.apiKey(parent, "hidden")).resolves.toBeNull();
    getMemberApiKey.mockRejectedValueOnce(new ForbiddenException());
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
    const getMemberApiKeyConnection = vi.fn().mockResolvedValue(result);
    const resolver = new WorkspaceApiKeyResolver({
      getMemberApiKeyConnection,
    } as unknown as WorkspaceApiKeyService);
    await expect(
      resolver.workspaceApiKeys(workspace, args, info),
    ).resolves.toBe(result);
    expect(getMemberApiKeyConnection).toHaveBeenCalledExactlyOnceWith(
      workspace,
      args,
      info,
    );
    getMemberApiKeyConnection.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      resolver.workspaceApiKeys(workspace, args, info),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
