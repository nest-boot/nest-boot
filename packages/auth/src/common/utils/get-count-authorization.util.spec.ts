import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { User } from "../../core/entities/user.entity.js";
import { AuthAbility } from "../auth.ability.js";
import { getCountAuthorization } from "./get-count-authorization.util.js";

describe("getCountAuthorization", () => {
  it("keeps higher-priority conditional restrictions when counting", () => {
    return RequestContext.run(new RequestContext({ type: "test" }), () => {
      const allowed = Object.assign(new User(), { name: "Allowed" });
      const denied = Object.assign(new User(), { name: "Denied" });
      RequestContext.set(User, allowed);
      RequestContext.set(
        AuthAbility,
        new AuthAbility([
          { action: "read", subject: User },
          {
            action: "read",
            subject: User,
            conditions: { name: "Denied" },
            inverted: true,
          },
        ]),
      );

      const assertMatch = getCountAuthorization("read", User);
      expect(assertMatch).toBeDefined();
      expect(() => assertMatch?.(allowed)).not.toThrow();
      expect(() => assertMatch?.(denied)).toThrow(ForbiddenException);
    });
  });
});
