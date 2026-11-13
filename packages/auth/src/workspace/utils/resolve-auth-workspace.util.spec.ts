import { RequestContext } from "@nest-boot/request-context";

import { stageIdentity } from "../../../test/fixtures/auth-context.fixture.js";
import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { SystemAccount } from "../../api-key/entities/system-account.entity.js";
import { SystemApiKey } from "../../api-key/objects/system-api-key.object.js";
import { User } from "../../core/entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { WorkspaceMember } from "../entities/workspace-member.entity.js";
import { resolveAuthWorkspace } from "./resolve-auth-workspace.util.js";

describe("authenticated workspace scope", () => {
  it("returns no workspace outside an active request", () => {
    expect(resolveAuthWorkspace({ workspace: { enabled: true } })).toBeNull();
  });
  it.each([
    "active",
    "disabled",
    "wrong-user",
    "wrong-workspace",
    "anonymous",
    "unselected",
  ])("requires verified membership rather than selection alone (%s)", (state) =>
    RequestContext.run(new RequestContext({ type: "test" }), () => {
      const user = new User();
      const workspace = new Workspace();
      const member = Object.assign(new WorkspaceMember(), {
        user: state === "wrong-user" ? new User() : user,
        workspace: state === "wrong-workspace" ? new Workspace() : workspace,
        status: state === "disabled" ? "DISABLED" : "ACTIVE",
      });
      stageIdentity({
        user: state === "anonymous" ? null : user,
        workspace: state === "unselected" ? null : workspace,
        member,
      });
      expect(resolveAuthWorkspace({ workspace: { enabled: true } })).toBe(
        state === "active" ? workspace : null,
      );
    }),
  );

  it.each([
    "workspace-grant",
    "user-only",
    "empty-key",
    "empty-account",
    "configuration-ceiling",
    "disabled-feature",
  ])("applies effective system grant ceilings (%s)", (state) =>
    RequestContext.run(new RequestContext({ type: "test" }), () => {
      const workspace = new Workspace();
      const grants =
        state === "user-only" ? ["user:read"] : ["workspace:read-any"];
      const account = Object.assign(new SystemAccount(), {
        permissions: state === "empty-account" ? [] : grants,
      });
      const key = Object.assign(new SystemApiKey(new ApiKey()), {
        owner: { id: account.id, unwrap: () => account },
        permissions: state === "empty-key" ? [] : grants,
      });
      const options = withAuthTestFeatures({
        workspace: { enabled: state !== "disabled-feature" },
        ...(state === "configuration-ceiling"
          ? {
              apiKey: {
                system: { allowedPermissions: ["user:read" as const] },
              },
            }
          : {}),
      });
      stageIdentity({ apiKey: key, user: null, member: null, workspace });
      expect(resolveAuthWorkspace(options)).toBe(
        state === "workspace-grant" ? workspace : null,
      );
    }),
  );
});
