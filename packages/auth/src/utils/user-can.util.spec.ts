import { RequestContext } from "@nest-boot/request-context";

import { UserAbility } from "../abilities/user.ability.js";
import { AccessControlService } from "../access-control.service.js";
import { userCan } from "./user-can.util.js";

class TestSubject {}

describe("userCan", () => {
  it("checks a permission with the cached user ability", async () => {
    const canMock = vi.fn(() => true);
    const ability = new UserAbility();
    vi.spyOn(ability, "can").mockImplementation(canMock);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(UserAbility, ability);

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

  it("delegates to AccessControlService when dependency injection is available", async () => {
    const accessControlService = {
      userCan: vi.fn().mockReturnValue(false),
    };

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(
        AccessControlService,
        accessControlService as unknown as AccessControlService,
      );

      expect(userCan("update", TestSubject)).toBe(false);
    });

    expect(accessControlService.userCan).toHaveBeenCalledWith(
      "update",
      TestSubject,
    );
  });
});
