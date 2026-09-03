import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { USER_PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";
import { userCan } from "./user-can.util.js";

class TestSubject {}

describe("userCan", () => {
  it("checks a permission with the cached user ability", async () => {
    const canMock = vi.fn(() => true);
    const ability = { can: canMock } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, ability);

      expect(userCan("update", TestSubject)).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("throws when the user ability is not cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => userCan("update", TestSubject)).toThrow(ForbiddenException);
    });
  });
});
