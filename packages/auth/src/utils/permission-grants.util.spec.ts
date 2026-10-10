import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import {
  Member,
  MemberApiKey,
  User,
  UserApiKey,
  Workspace,
} from "../entities/index.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
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
        [scope]: {
          permissions: ["report:read", "report:write", "report:delete"],
          roles: { reader: ["report:read"] },
        },
      };
      expect(canGrantPermissions(options, scope, ["report:read"])).toBe(false);
      expect(() => {
        assertCanGrantPermissions(options, scope, ["report:read"]);
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
          canGrantPermissions(options, scope, ["report:read", "report:write"]),
        ).toBe(true);
        expect(canGrantPermissions(options, scope, ["report:delete"])).toBe(
          false,
        );
        expect(() => {
          assertCanGrantPermissions(options, scope, [
            "report:read",
            "report:write",
          ]);
        }).not.toThrow();
        expect(() => {
          assertCanGrantPermissions(options, scope, ["report:delete"]);
        }).toThrow("permissions exceed issuer permissions");
        RequestIdentity.stage({
          apiKey: Object.assign(new UserApiKey(), {
            permissions: ["report:read", "report:delete"],
          }),
        });
        expect(canGrantPermissions(options, scope, ["report:read"])).toBe(true);
        expect(canGrantPermissions(options, scope, ["report:write"])).toBe(
          false,
        );
        expect(canGrantPermissions(options, scope, ["report:delete"])).toBe(
          false,
        );
      });
    },
  );

  it("keeps member keys out of user grants and enforces credential ceilings", async () => {
    await RequestContext.run(new RequestContext({ type: "test" }), () => {
      expect(() => {
        assertApiKeyPermissionCeiling({}, ["report:write"]);
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
        apiKey: Object.assign(new MemberApiKey(), {
          member,
          permissions: ["report:read"],
        }),
      });
      expect(canGrantPermissions({}, "workspace", ["report:read"])).toBe(true);
      expect(canGrantPermissions({}, "user", ["report:read"])).toBe(false);
      expect(() => {
        assertApiKeyPermissionCeiling({}, ["report:read"]);
      }).not.toThrow();
      expect(() => {
        assertApiKeyPermissionCeiling({}, ["report:write"]);
      }).toThrow("authenticating API key permissions: report:write");
      RequestIdentity.stage({
        apiKey: Object.assign(new MemberApiKey(), { member, permissions: [] }),
      });
      expect(() => {
        assertApiKeyPermissionCeiling({}, ["report:read"]);
      }).not.toThrow();
      expect(canGrantPermissions({}, "workspace", ["report:read"])).toBe(true);
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
