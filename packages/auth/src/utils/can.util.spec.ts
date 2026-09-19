import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { can } from "./can.util.js";

class TestSubject {}

describe("can", () => {
  it("routes to workspaceCan by default", async () => {
    const canMock = vi.fn(() => true);
    const ability = new WorkspaceAbility();
    vi.spyOn(ability, "can").mockImplementation(canMock);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(Member, new Member());
      RequestContext.set(Workspace, new Workspace());
      RequestContext.set(AccessControlService, new AccessControlService({}));
      RequestContext.set(WorkspaceAbility, ability);

      expect(can("update", TestSubject)).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("routes an explicit user scope to userCan", async () => {
    const canMock = vi.fn(() => true);
    const ability = new UserAbility();
    vi.spyOn(ability, "can").mockImplementation(canMock);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(User, new User());
      RequestContext.set(AccessControlService, new AccessControlService({}));
      RequestContext.set(UserAbility, ability);

      expect(can("update", TestSubject, { scope: "user" })).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("routes an explicit workspace scope to workspaceCan", async () => {
    const canMock = vi.fn(() => true);
    const ability = new WorkspaceAbility();
    vi.spyOn(ability, "can").mockImplementation(canMock);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(Member, new Member());
      RequestContext.set(Workspace, new Workspace());
      RequestContext.set(AccessControlService, new AccessControlService({}));
      RequestContext.set(WorkspaceAbility, ability);

      expect(can("update", TestSubject, { scope: "workspace" })).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });
});
