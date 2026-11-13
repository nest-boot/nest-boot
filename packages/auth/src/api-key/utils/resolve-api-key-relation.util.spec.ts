import { ref } from "@mikro-orm/core";
import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { mockAuthorization } from "../../../test/mock-authorization.js";
import { User } from "../../core/entities/user.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { SystemApiKey } from "../objects/system-api-key.object.js";
import { UserApiKey } from "../objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../objects/workspace-api-key.object.js";
import { resolveApiKeyRelation } from "./resolve-api-key-relation.util.js";

describe("resolveApiKeyRelation", () => {
  let authorization: ReturnType<typeof mockAuthorization>;
  beforeEach(() => {
    authorization = mockAuthorization();
  });

  it("resolves each concrete identity through its own lookup", async () => {
    const user = new User();
    const member = new WorkspaceMember();
    const system = new SystemAccount();
    const users = vi.fn().mockResolvedValue(user);
    const members = vi.fn().mockResolvedValue(member);
    const systems = vi.fn().mockResolvedValue(system);
    const userKey = Object.assign(new UserApiKey(new ApiKey()), {
      user: ref(User, user),
    });
    const workspaceKey = Object.assign(new WorkspaceApiKey(new ApiKey()), {
      member: ref(WorkspaceMember, member),
    });
    const systemKey = Object.assign(new SystemApiKey(new ApiKey()), {
      owner: ref(SystemAccount, system),
    });
    await expect(
      resolveApiKeyRelation(userKey, userKey.user, User, users),
    ).resolves.toBe(user);
    await expect(
      resolveApiKeyRelation(
        workspaceKey,
        workspaceKey.member,
        WorkspaceMember,
        members,
      ),
    ).resolves.toBe(member);
    await expect(
      resolveApiKeyRelation(
        systemKey,
        systemKey.systemAccount,
        SystemAccount,
        systems,
        false,
      ),
    ).resolves.toBe(system);
    expect(users).toHaveBeenCalledExactlyOnceWith(user.id);
    expect(members).toHaveBeenCalledExactlyOnceWith(member.id);
    expect(systems).toHaveBeenCalledExactlyOnceWith(system.id);
  });

  it.each([
    "key forbidden",
    "identity forbidden",
    "lookup forbidden",
    "lookup failed",
  ])("handles %s without granting identity access", async (state) => {
    const user = new User();
    const key = Object.assign(new UserApiKey(new ApiKey()), {
      user: ref(User, user),
    });
    const read = vi.fn().mockResolvedValue(user);
    if (state === "key forbidden") {
      authorization.authorize.mockImplementation(() => {
        throw new ForbiddenException();
      });
    }
    if (state === "identity forbidden") {
      authorization.can.mockReturnValue(false);
    }
    if (state === "lookup forbidden") {
      read.mockRejectedValue(new ForbiddenException());
    }
    if (state === "lookup failed") {
      read.mockRejectedValue(new Error("database unavailable"));
    }
    const result = resolveApiKeyRelation(key, key.user, User, read);
    if (state === "lookup failed") {
      await expect(result).rejects.toThrow("database unavailable");
    } else {
      await expect(result).resolves.toBeNull();
    }
    if (state === "key forbidden" || state === "identity forbidden") {
      expect(read).not.toHaveBeenCalled();
    }
  });

  it("returns null when a retained audit record has no populated identity", async () => {
    const read = vi.fn();
    await expect(
      resolveApiKeyRelation(
        new SystemApiKey(new ApiKey()),
        null,
        SystemAccount,
        read,
        false,
      ),
    ).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("retains self-profile access without exposing another identity", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      const user = new User();
      const member = new WorkspaceMember();
      const other = new User();
      RequestContext.set(User, user);
      RequestContext.set(WorkspaceMember, member);
      authorization.can.mockReturnValue(false);
      const read = vi.fn();
      const key = Object.assign(new UserApiKey(new ApiKey()), {
        user: ref(User, user),
      });
      const workspaceKey = Object.assign(new WorkspaceApiKey(new ApiKey()), {
        member: ref(WorkspaceMember, member),
      });
      await expect(
        resolveApiKeyRelation(key, key.user, User, read),
      ).resolves.toBe(user);
      await expect(
        resolveApiKeyRelation(
          workspaceKey,
          workspaceKey.member,
          WorkspaceMember,
          read,
        ),
      ).resolves.toBe(member);
      await expect(
        resolveApiKeyRelation(key, ref(User, other), User, read),
      ).resolves.toBeNull();
      expect(read).not.toHaveBeenCalled();
    });
  });
});
