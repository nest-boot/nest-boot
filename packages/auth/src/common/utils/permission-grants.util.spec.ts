import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { withAuthTestFeatures } from "../../../test/fixtures/enabled-auth-features.fixture.js";
import { ApiKey } from "../../api-key/entities/api-key.entity.js";
import { UserApiKey } from "../../api-key/objects/user-api-key.object.js";
import { WorkspaceApiKey } from "../../api-key/objects/workspace-api-key.object.js";
import { User } from "../../core/entities/user.entity.js";
import { RequestIdentity } from "../../core/request-identity.js";
import { Member } from "../../workspace/entities/member.entity.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import {
  assertApiKeyPermissionCeiling,
  assertCanGrantPermissions,
  assertPermissionCeiling,
  canGrantPermissions,
} from "./permission-grants.util.js";

describe("permission delegation", () => {
  it.each(["user", "workspace"] as const)(
    "checks %s roles, direct grants, and credential limits through one snapshot",
    async (scope) => {
      const options = {
        workspace: { enabled: true },
        [scope]: {
          ...(scope === "workspace" ? { enabled: true } : {}),
          permissions: ["report:read", "report:write", "report:delete"],
          roles: { reader: ["report:read"] },
        },
      };
      expect(
        canGrantPermissions(withAuthTestFeatures(options), scope, [
          "report:read",
        ]),
      ).toBe(false);
      expect(() => {
        assertCanGrantPermissions(withAuthTestFeatures(options), scope, [
          "report:read",
        ]);
      }).toThrow(ForbiddenException);
      await RequestContext.run(new RequestContext({ type: "test" }), () => {
        const user = Object.assign(new User(), {
          roles: ["reader"],
          permissions: ["report:write"],
        });
        const workspace = new Workspace();
        const member = Object.assign(new Member(), {
          user,
          workspace,
          roles: ["reader"],
          permissions: ["report:write"],
        });
        RequestIdentity.stage({ user, member, workspace });
        expect(
          canGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:read",
            "report:write",
          ]),
        ).toBe(true);
        expect(
          canGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:delete",
          ]),
        ).toBe(false);
        expect(() => {
          assertCanGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:read",
            "report:write",
          ]);
        }).not.toThrow();
        expect(() => {
          assertCanGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:delete",
          ]);
        }).toThrow("permissions exceed issuer permissions");
        RequestIdentity.stage({
          apiKey: Object.assign(new UserApiKey(new ApiKey()), {
            permissions: ["report:read", "report:delete"],
          }),
        });
        expect(
          canGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:read",
          ]),
        ).toBe(true);
        expect(
          canGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:write",
          ]),
        ).toBe(false);
        expect(
          canGrantPermissions(withAuthTestFeatures(options), scope, [
            "report:delete",
          ]),
        ).toBe(false);
      });
    },
  );

  it("keeps member keys out of user grants and enforces credential ceilings", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(() => {
        assertApiKeyPermissionCeiling({ workspace: { enabled: true } }, [
          "report:write",
        ]);
      }).not.toThrow();
      const workspace = new Workspace();
      const member = Object.assign(new Member(), {
        workspace,
        type: "SERVICE_ACCOUNT",
        roles: [],
        permissions: ["report:read"],
      });
      RequestIdentity.stage({
        workspace,
        member,
        apiKey: Object.assign(new WorkspaceApiKey(new ApiKey()), {
          member,
          permissions: ["report:read"],
        }),
      });
      expect(
        canGrantPermissions(
          withAuthTestFeatures({ workspace: { enabled: true } }),
          "workspace",
          ["report:read"],
        ),
      ).toBe(true);
      expect(
        canGrantPermissions(
          withAuthTestFeatures({ workspace: { enabled: true } }),
          "user",
          ["report:read"],
        ),
      ).toBe(false);
      expect(() => {
        assertApiKeyPermissionCeiling({ workspace: { enabled: true } }, [
          "report:read",
        ]);
      }).not.toThrow();
      expect(() => {
        assertApiKeyPermissionCeiling({ workspace: { enabled: true } }, [
          "report:write",
        ]);
      }).toThrow("authenticating API key permissions: report:write");
      RequestIdentity.stage({
        apiKey: Object.assign(new WorkspaceApiKey(new ApiKey()), {
          member,
          permissions: [],
        }),
      });
      expect(() => {
        assertApiKeyPermissionCeiling({ workspace: { enabled: true } }, [
          "report:read",
        ]);
      }).not.toThrow();
      expect(
        canGrantPermissions(
          withAuthTestFeatures({ workspace: { enabled: true } }),
          "workspace",
          ["report:read"],
        ),
      ).toBe(true);
    });
  });

  it("compares exact permission values and reports only excessive grants", () => {
    expect(() => {
      assertPermissionCeiling([], [], "Denied");
    }).not.toThrow();
    expect(() => {
      assertPermissionCeiling(["report:read"], ["report:read"], "Denied");
    }).not.toThrow();
    expect(() => {
      assertPermissionCeiling(
        ["report:read", "Report:read"],
        ["report:read"],
        "Denied",
      );
    }).toThrow("Denied: Report:read");
  });
});
