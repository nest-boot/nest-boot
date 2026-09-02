import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { USER_PERMISSION_ABILITY } from "../permission.constants.js";
import { getPermissionAbility } from "./get-permission-ability.util.js";

describe("getPermissionAbility", () => {
  it("throws when no permission ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getPermissionAbility("user")).toThrow(ForbiddenException);
    });
  });

  it("throws when cached permission ability is null", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, null);

      expect(() => getPermissionAbility("user")).toThrow(ForbiddenException);
    });
  });

  it("reads the permission ability from request context", async () => {
    const ability = { can: vi.fn() };

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(USER_PERMISSION_ABILITY, ability);

        expect(getPermissionAbility("user")).toBe(ability);
      },
    );
  });
});
