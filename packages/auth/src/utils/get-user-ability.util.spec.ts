import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { getUserAbility } from "./get-user-ability.util.js";

describe("getUserAbility", () => {
  it("throws when no user ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getUserAbility()).toThrow(ForbiddenException);
    });
  });

  it("does not read a workspace ability as a user ability", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WorkspaceAbility, new WorkspaceAbility());

      expect(() => getUserAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the user ability from request context", async () => {
    const ability = new UserAbility();

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(UserAbility, ability);

        expect(getUserAbility()).toBe(ability);
      },
    );
  });
});
