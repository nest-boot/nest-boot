import { ref } from "@mikro-orm/core";

import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { WorkspaceApiKey } from "./workspace-api-key.object.js";

describe("WorkspaceApiKey", () => {
  it("exposes its concrete identity relation", () => {
    const owner = new Member();
    const key = Object.assign(new WorkspaceApiKey(new ApiKey()), {
      member: ref(Member, owner),
    });
    expect(key.ownerType).toBe("member");
    expect(key.member?.id).toBe(owner.id);
    expect(key.id).toEqual(expect.any(String));
    expect(key.enabled).toBe(true);
    expect(key.permissions).toEqual([]);
    expect(key.updatedAt).toBeInstanceOf(Date);
    const workspace = new Workspace();
    owner.workspace = ref(Workspace, workspace);
    expect(key.memberId).toBe(owner.id);
    expect(key.workspaceId).toBe(workspace.id);
  });
});
