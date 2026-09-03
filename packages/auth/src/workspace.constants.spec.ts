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
    expect(DEFAULT_WORKSPACE_PERMISSIONS).toContain(
      "workspaceInvitation:create",
    );
  });

  it("grants full access to owners, restricted access to admins, and none to members", () => {
    expect(DEFAULT_WORKSPACE_ROLES).toEqual({
      owner: [
        "workspace:update",
        "workspace:delete",
        "workspaceMember:create",
        "workspaceMember:update",
        "workspaceMember:delete",
        "workspaceInvitation:create",
        "workspaceInvitation:cancel",
      ],
      admin: [
        "workspace:update",
        "workspaceMember:create",
        "workspaceMember:update",
        "workspaceMember:delete",
        "workspaceInvitation:create",
        "workspaceInvitation:cancel",
      ],
      member: [],
    });
  });
});
