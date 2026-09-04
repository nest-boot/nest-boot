import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

describe("getWorkspaceAbility", () => {
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
        context.set(WorkspaceAbility, ability);

        expect(getWorkspaceAbility()).toBe(ability);
      },
    );
  });
});
