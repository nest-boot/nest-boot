import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

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

  it("throws when the workspace ability is not cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => workspaceCan("update", TestSubject)).toThrow(
        ForbiddenException,
      );
    });
  });
});
