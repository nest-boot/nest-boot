import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { UserAbility } from "../abilities/user.ability.js";
import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { User } from "../entities/user.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { getUserAbility } from "./get-user-ability.util.js";

describe("getUserAbility", () => {
  it("rejects a cached ability without the authorization service", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(UserAbility, new UserAbility());
      expect(() => getUserAbility()).toThrow(ForbiddenException);
    });
    expect(() => getUserAbility()).toThrow(ForbiddenException);
  });

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
        context.set(AccessControlService, new AccessControlService({}));
        context.set(User, new User());
        context.set(UserAbility, ability);

        expect(getUserAbility()).toBe(ability);
      },
    );
  });
});
