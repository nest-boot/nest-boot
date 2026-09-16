import { ForbiddenException } from "@nestjs/common";

import { ApiKey as BaseApiKey } from "../entities/api-key.entity.js";
import { User as BaseUser } from "../entities/user.entity.js";
import { Workspace as BaseWorkspace } from "../entities/workspace.entity.js";
import { type ApiKeyService } from "../services/api-key.service.js";
import { type UserService } from "../services/user.service.js";
import { type WorkspaceService } from "../services/workspace.service.js";
import { UserResolver } from "./user.resolver.js";
import { WorkspaceResolver } from "./workspace.resolver.js";

describe("API-key field delegation", () => {
  it.each(["user", "workspace"] as const)(
    "passes the %s parent and ID to the service, preserving null and authorization errors",
    async (scope) => {
      const key = new BaseApiKey();
      const getKey = vi.fn().mockResolvedValue(key);
      const service = {
        getUserApiKey: getKey,
        getWorkspaceApiKey: getKey,
      } as unknown as ApiKeyService;
      const user = new BaseUser();
      const workspace = new BaseWorkspace();
      const resolve =
        scope === "user"
          ? () =>
              new UserResolver(
                {} as UserService,
                {} as WorkspaceService,
                service,
                {} as never,
                {} as never,
                {} as never,
              ).apiKey(user, "key_1")
          : () =>
              new WorkspaceResolver(
                {} as WorkspaceService,
                service,
                {} as never,
                {} as never,
              ).apiKey(workspace, "key_1");

      await expect(resolve()).resolves.toBe(key);
      expect(getKey).toHaveBeenCalledWith(
        "key_1",
        scope === "user" ? user : workspace,
      );
      getKey.mockResolvedValue(null);
      await expect(resolve()).resolves.toBeNull();
      getKey.mockRejectedValue(new ForbiddenException());
      await expect(resolve()).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
});
