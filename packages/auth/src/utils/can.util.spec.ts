import { RequestContext } from "@nest-boot/request-context";

import {
  USER_PERMISSION_ABILITY,
  WORKSPACE_PERMISSION_ABILITY,
} from "../permission.constants.js";
import type { PermissionAbility } from "../types/permission-ability.type.js";
import { can } from "./can.util.js";

class TestSubject {}

describe("can", () => {
  it("routes to workspaceCan by default", async () => {
    const canMock = vi.fn(() => true);
    const ability = { can: canMock } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WORKSPACE_PERMISSION_ABILITY, ability);

      expect(can("update", TestSubject)).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("routes an explicit user scope to userCan", async () => {
    const canMock = vi.fn(() => true);
    const ability = { can: canMock } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(USER_PERMISSION_ABILITY, ability);

      expect(can("update", TestSubject, { scope: "user" })).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });

  it("routes an explicit workspace scope to workspaceCan", async () => {
    const canMock = vi.fn(() => true);
    const ability = { can: canMock } as unknown as PermissionAbility;

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WORKSPACE_PERMISSION_ABILITY, ability);

      expect(can("update", TestSubject, { scope: "workspace" })).toBe(true);
    });

    expect(canMock).toHaveBeenCalledWith("update", TestSubject);
  });
});
