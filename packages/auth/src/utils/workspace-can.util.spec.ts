import { RequestContext } from "@nest-boot/request-context";

import { AuthorizationService } from "../authorization.service.js";
import { WORKSPACE_PERMISSION_ABILITY } from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";
import { workspaceCan } from "./workspace-can.util.js";

class TestSubject {}

describe("workspaceCan", () => {
  it("checks a permission with the cached workspace ability", async () => {
    const canMock = vi.fn(() => true);
    const ability = { can: canMock } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WORKSPACE_PERMISSION_ABILITY, ability);

      expect(workspaceCan("update", TestSubject)).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("returns false when the workspace ability is not cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(workspaceCan("update", TestSubject)).toBe(false);
    });
  });

  it("returns false outside a request context", () => {
    expect(workspaceCan("update", TestSubject)).toBe(false);
  });

  it("delegates to AuthorizationService when dependency injection is available", async () => {
    const authorizationService = {
      workspaceCan: vi.fn().mockReturnValue(false),
    };

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(
        AuthorizationService,
        authorizationService as unknown as AuthorizationService,
      );

      expect(workspaceCan("update", TestSubject)).toBe(false);
    });

    expect(authorizationService.workspaceCan).toHaveBeenCalledWith(
      "update",
      TestSubject,
    );
  });
});
