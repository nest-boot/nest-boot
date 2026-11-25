import { ForbiddenException } from "@nestjs/common";

import { User } from "../../core/entities/user.entity.js";
import { UserWorkspaceResolver } from "./user-workspace.resolver.js";

describe("UserWorkspaceResolver", () => {
  it.each([
    ["workspaces", "getWorkspaceConnectionByUser"],
    ["invitations", "getWorkspaceInvitationConnectionByUser"],
  ] as const)(
    "preserves the parent and authorization for %s",
    async (field, method) => {
      const result = { edges: [], pageInfo: {} };
      const query = vi.fn().mockResolvedValue(result);
      const service = { [method]: query };
      const resolver = new UserWorkspaceResolver(
        service as never,
        service as never,
      );
      const parent = Object.assign(new User(), { id: "parent-user" });
      const args = { first: 2, after: "cursor" };
      await expect(resolver[field](parent, args)).resolves.toBe(result);
      expect(query).toHaveBeenCalledExactlyOnceWith(parent, args);
      const denied = new ForbiddenException();
      query.mockRejectedValue(denied);
      await expect(resolver[field](parent, args)).rejects.toBe(denied);
    },
  );
});
