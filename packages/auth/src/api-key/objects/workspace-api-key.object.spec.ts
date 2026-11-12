import { ref } from "@mikro-orm/core";

import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { WorkspaceApiKey } from "./workspace-api-key.object.js";

describe("WorkspaceApiKey", () => {
  it("exposes its concrete identity relation", () => {
    const owner = new WorkspaceMember();
    const key = Object.assign(new WorkspaceApiKey(new ApiKey()), {
      member: ref(WorkspaceMember, owner),
    });
    expect(key.ownerType).toBe("workspace_member");
    expect(key.member?.id).toBe(owner.id);
    expect(key.id).toEqual(expect.any(String));
    expect(key.revokedAt).toBeNull();
    expect(key.permissions).toEqual([]);
    expect(key.updatedAt).toBeInstanceOf(Date);
    const workspace = new Workspace();
    owner.workspace = ref(Workspace, workspace);
    expect(key.memberId).toBe(owner.id);
    expect(key.workspaceId).toBe(workspace.id);
  });
});
