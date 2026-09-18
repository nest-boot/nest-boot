import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { Member } from "../entities/member.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

describe("getWorkspaceAbility", () => {
  it("rejects a cached ability without the authorization service", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());
      expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
    });
    expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
  });

  it("throws when no workspace ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
    });
  });

  it("does not read a user ability as a workspace ability", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(UserAbility, new UserAbility());

      expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the workspace ability from request context", async () => {
    const ability = new WorkspaceAbility();

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(AccessControlService, new AccessControlService({}));
        context.set(Workspace, new Workspace());
        context.set(Member, new Member());
        context.set(WorkspaceAbility, ability);

        expect(getWorkspaceAbility()).toBe(ability);
      },
    );
  });
});
