import { RequestContext } from "@nest-boot/request-context";

import { WorkspaceAbility } from "../abilities/workspace.ability.js";
import { AccessControlService } from "../access-control.service.js";
import { workspaceCan } from "./workspace-can.util.js";

class TestSubject {}

describe("workspaceCan", () => {
  it("checks a permission with the cached workspace ability", async () => {
    const canMock = vi.fn(() => true);
    const ability = new WorkspaceAbility();
    vi.spyOn(ability, "can").mockImplementation(canMock);

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(WorkspaceAbility, ability);

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

  it("delegates to AccessControlService when dependency injection is available", async () => {
    const accessControlService = {
      workspaceCan: vi.fn().mockReturnValue(false),
    };

    await RequestContext.run(new RequestContext({ type: "http" }), () => {
      RequestContext.set(
        AccessControlService,
        accessControlService as unknown as AccessControlService,
      );

      expect(workspaceCan("update", TestSubject)).toBe(false);
    });

    expect(accessControlService.workspaceCan).toHaveBeenCalledWith(
      "update",
      TestSubject,
    );
  });
});
