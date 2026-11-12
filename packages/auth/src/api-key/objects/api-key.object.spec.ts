import { ref } from "@mikro-orm/core";

import { AuthAbility } from "../../common/auth.ability.js";
import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { SystemAccount } from "../entities/system-account.entity.js";
import { toApiKeyView } from "../utils/api-key-view.util.js";
import { SystemApiKey } from "./system-api-key.object.js";
import { UserApiKey } from "./user-api-key.object.js";
import { WorkspaceApiKey } from "./workspace-api-key.object.js";

describe("credential DTO authorization boundaries", () => {
  it("evaluates workspace and member conditions against the current concrete identity", () => {
    const workspace = new Workspace();
    const member = Object.assign(new WorkspaceMember(), {
      workspace: ref(Workspace, workspace),
    });
    const key = new WorkspaceApiKey();
    key.member = member;
    const ability = new AuthAbility([
      {
        action: "write",
        subject: WorkspaceApiKey,
        conditions: { workspaceId: workspace.id, memberId: member.id },
      },
    ]);
    expect(ability.can("write", key)).toBe(true);
    expect(key.user).toBeUndefined();
    expect(key.systemAccount).toBeUndefined();

    const otherWorkspace = new Workspace();
    const otherMember = Object.assign(new WorkspaceMember(), {
      workspace: ref(Workspace, otherWorkspace),
    });
    key.member = ref(WorkspaceMember, otherMember);
    expect(ability.can("write", key)).toBe(false);
    // An omitted identity in a partial metadata assignment must not clear ownership.
    Object.assign(key, { member: undefined });
    expect(key.member.id).toBe(otherMember.id);
    expect(ability.can("write", key)).toBe(false);
  });

  it("preserves account-based conditions when native keys become hash-free DTOs", () => {
    const account = new SystemAccount();
    const otherAccount = new SystemAccount();
    const ability = new AuthAbility([
      {
        action: "write",
        subject: SystemApiKey,
        conditions: { systemAccountId: account.id },
      },
    ]);
    for (const owner of [account, otherAccount]) {
      const record = Object.assign(new ApiKey(), {
        owner: ref(SystemAccount, owner),
        key: "credential-hash",
      });
      const view = toApiKeyView(record);
      expect(ability.can("write", record)).toBe(owner === account);
      expect(ability.can("write", view)).toBe(owner === account);
      expect(view).not.toHaveProperty("key");
      expect(view.user).toBeUndefined();
      expect(view.member).toBeUndefined();
    }
  });

  it("keeps user conditions bound to the assigned user across partial updates", () => {
    const user = new User();
    const anotherUser = new User();
    const key = new UserApiKey();
    key.user = user;
    const ability = new AuthAbility([
      {
        action: "read",
        subject: UserApiKey,
        conditions: { "user.id": user.id },
      },
    ]);
    expect(ability.can("read", key)).toBe(true);
    key.user = ref(User, anotherUser);
    expect(ability.can("read", key)).toBe(false);
    Object.assign(key, { user: undefined });
    expect(key.user.id).toBe(anotherUser.id);
    expect(key.member).toBeUndefined();
    expect(key.systemAccount).toBeUndefined();
  });

  it("rejects foreign-scope identifiers instead of supplying misleading authorization IDs", () => {
    const key = new UserApiKey();
    key.user = new User();
    expect(() => key.memberId).toThrow("no member owner");
    expect(() => key.workspaceId).toThrow("no member owner");
    expect(() => key.systemAccountId).toThrow("no system-account owner");
  });
});
