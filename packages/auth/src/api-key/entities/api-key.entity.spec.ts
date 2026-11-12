import { ref } from "@mikro-orm/core";

import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "./api-key.entity.js";
import { SystemAccount } from "./system-account.entity.js";

describe("ApiKey identity accessors", () => {
  it("exposes only the matching owner and its authorization identifiers", () => {
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      workspace: ref(Workspace, workspace),
    });
    const key = Object.assign(new ApiKey(), { member });
    expect(key.ownerType).toBe("workspace_member");
    expect(key.member?.id).toBe(member.id);
    expect(key.memberId).toBe(member.id);
    expect(key.workspaceId).toBe(workspace.id);
    expect(key.user).toBeUndefined();
    expect(key.systemAccount).toBeUndefined();
    expect(() => key.systemAccountId).toThrow("no system-account owner");
  });

  it("switches owners through the user setter and rejects member-only identifiers", () => {
    const key = new ApiKey();
    key.member = new WorkspaceMember();
    const user = new User();
    key.user = user;
    expect(key.ownerType).toBe("user");
    expect(key.user?.id).toBe(user.id);
    expect(key.member).toBeUndefined();
    expect(key.systemAccount).toBeUndefined();
    expect(() => key.memberId).toThrow("no member owner");
    expect(() => key.workspaceId).toThrow("no member owner");
    key.user = undefined;
    key.member = undefined;
    expect(key.owner.id).toBe(user.id);
  });

  it("exposes system-account and nullable audit identifiers independently", () => {
    const account = new SystemAccount();
    const key = Object.assign(new ApiKey(), {
      owner: ref(SystemAccount, account),
    });
    expect(key.ownerType).toBe("system_account");
    expect(key.systemAccount?.id).toBe(account.id);
    expect(key.systemAccountId).toBe(account.id);
    expect(key.user).toBeUndefined();
    expect(key.member).toBeUndefined();
    expect(key.createdById).toBeNull();
    const administrator = new User();
    key.createdBy = ref(User, administrator);
    expect(key.createdById).toBe(administrator.id);
    expect(key.systemAccountId).toBe(account.id);
  });
});
