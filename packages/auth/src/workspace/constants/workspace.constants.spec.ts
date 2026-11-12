import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_CREATOR_ROLE,
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLE,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

describe("DEFAULT_WORKSPACE_ROLES", () => {
  it("declares default member and creator role names", () => {
    expect(DEFAULT_WORKSPACE_ROLE).toBe("member");
    expect(DEFAULT_WORKSPACE_CREATOR_ROLE).toBe("owner");
  });

  it("declares the complete default workspace permission catalog", () => {
    expect(DEFAULT_WORKSPACE_PERMISSIONS).toContain("workspace:delete");
    expect(DEFAULT_WORKSPACE_PERMISSIONS).toContain("workspace-member:invite");
  });

  it("grants full owner access, scoped administration, and explicit member reads", () => {
    expect(DEFAULT_WORKSPACE_ROLES).toEqual({
      owner: [
        "workspace:read",
        "workspace:update",
        "workspace:delete",
        "workspace-member:read",
        "workspace-member:write",
        "workspace-member:set-roles",
        "workspace-member:set-permissions",
        "workspace-member:invite",
        "workspace-service-account:read",
        "workspace-service-account:write",
        "workspace-api-key:read",
        "workspace-api-key:write",
      ],
      admin: [
        "workspace:read",
        "workspace:update",
        "workspace-member:read",
        "workspace-member:write",
        "workspace-member:set-roles",
        "workspace-member:set-permissions",
        "workspace-member:invite",
        "workspace-service-account:read",
        "workspace-service-account:write",
      ],
      member: ["workspace:read", "workspace-member:read"],
    });
  });
});
