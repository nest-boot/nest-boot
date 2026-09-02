import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { USER_PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";
import { can } from "./can.util.js";

class TestSubject {}

describe("can", () => {
  it("checks permissions with cached current ability", async () => {
    const canMock = vi.fn(() => true);
    const ability = {
      can: canMock,
    } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, ability);

      expect(
        can("update", TestSubject, {
          scope: "user",
        }),
      ).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("throws when permission ability is not cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() =>
        can("update", TestSubject, {
          scope: "user",
        }),
      ).toThrow(ForbiddenException);
    });
  });

  it("throws when cached permission ability is null", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, null);

      expect(() =>
        can("update", TestSubject, {
          scope: "user",
        }),
      ).toThrow(ForbiddenException);
    });
  });
});
