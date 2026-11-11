import { ref } from "@mikro-orm/core";

import { Member } from "./member.entity.js";
import { MemberApiKey } from "./member-api-key.entity.js";
import { Workspace } from "./workspace.entity.js";

describe("MemberApiKey", () => {
  it("exposes its owner through the existing management accessor", () => {
    const owner = new Member();
    const key = Object.assign(new MemberApiKey(), {
      member: ref(Member, owner),
    });
    expect(key.ownerType).toBe("member");
    expect(key.owner).toBe(key.member);
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
