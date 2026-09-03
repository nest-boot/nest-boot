import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { USER_PERMISSION_ABILITY } from "../permission.constants.js";
import { getUserAbility } from "./get-user-ability.util.js";

describe("getUserAbility", () => {
  it("throws when no user ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getUserAbility()).toThrow(ForbiddenException);
    });
  });

  it("throws when the cached user ability is null", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, null);

      expect(() => getUserAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the user ability from request context", async () => {
    const ability = { can: vi.fn() };

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(USER_PERMISSION_ABILITY, ability);

        expect(getUserAbility()).toBe(ability);
      },
    );
  });
});
