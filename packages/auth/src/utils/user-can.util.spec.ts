import { RequestContext } from "@nest-boot/request-context";

import { AuthorizationService } from "../authorization.service.js";
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

  it("returns false when the user ability is not cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(userCan("update", TestSubject)).toBe(false);
    });
  });

  it("returns false outside a request context", () => {
    expect(userCan("update", TestSubject)).toBe(false);
  });

  it("delegates to AuthorizationService when dependency injection is available", async () => {
    const authorizationService = {
      userCan: vi.fn().mockReturnValue(false),
    };

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(
        AuthorizationService,
        authorizationService as unknown as AuthorizationService,
      );

      expect(userCan("update", TestSubject)).toBe(false);
    });

    expect(authorizationService.userCan).toHaveBeenCalledWith(
      "update",
      TestSubject,
    );
  });
});
