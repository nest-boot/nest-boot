import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { PERMISSION_ABILITY } from "../permission.constants.js";
import { getPermissionAbility } from "./get-permission-ability.util.js";

describe("getPermissionAbility", () => {
  it("throws when no permission ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getPermissionAbility()).toThrow(ForbiddenException);
    });
  });

  it("throws when cached permission ability is null", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(PERMISSION_ABILITY, null);

      expect(() => getPermissionAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the permission ability from request context", async () => {
    const ability = { can: vi.fn() };

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(PERMISSION_ABILITY, ability);

        expect(getPermissionAbility()).toBe(ability);
      },
    );
  });
});
