import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { AuthAbility } from "../abilities/auth.ability.js";
import { User } from "../entities/user.entity.js";
import { AccessControlService } from "../services/access-control.service.js";
import { getAbility } from "./get-ability.util.js";

describe("unified getAbility", () => {
  it("rejects a cached ability without the authorization service", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(AuthAbility, new AuthAbility());
      expect(() => getAbility()).toThrow(ForbiddenException);
    });
    expect(() => getAbility()).toThrow(ForbiddenException);
  });

  it("throws when no user ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getAbility()).toThrow(ForbiddenException);
    });
  });

  it("does not read a workspace ability as a user ability", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(AuthAbility, new AuthAbility());

      expect(() => getAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the user ability from request context", async () => {
    const ability = new AuthAbility();

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(AccessControlService, new AccessControlService({}));
        context.set(User, new User());
        context.set(AuthAbility, ability);

        expect(getAbility()).toBe(ability);
      },
    );
  });
});
