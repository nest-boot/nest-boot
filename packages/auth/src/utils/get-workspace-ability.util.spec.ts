import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { WORKSPACE_PERMISSION_ABILITY } from "../permission.constants.js";
import { getWorkspaceAbility } from "./get-workspace-ability.util.js";

describe("getWorkspaceAbility", () => {
  it("throws when no workspace ability is cached", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
    });
  });

  it("throws when the cached workspace ability is null", async () => {
    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WORKSPACE_PERMISSION_ABILITY, null);

      expect(() => getWorkspaceAbility()).toThrow(ForbiddenException);
    });
  });

  it("reads the workspace ability from request context", async () => {
    const ability = { can: vi.fn() };

    await RequestContext.run(
      new RequestContext({ type: "http" }),
      (context) => {
        context.set(WORKSPACE_PERMISSION_ABILITY, ability);

        expect(getWorkspaceAbility()).toBe(ability);
      },
    );
  });
});
