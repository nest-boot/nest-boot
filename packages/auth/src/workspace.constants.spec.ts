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
    expect(DEFAULT_WORKSPACE_PERMISSIONS).toContain("Workspace:delete");
    expect(DEFAULT_WORKSPACE_PERMISSIONS).toContain(
      "WorkspaceInvitation:create",
    );
  });

  it("grants full access to owners, restricted access to admins, and none to members", () => {
    expect(DEFAULT_WORKSPACE_ROLES).toEqual({
      owner: [
        "Workspace:update",
        "Workspace:delete",
        "WorkspaceMember:create",
        "WorkspaceMember:update",
        "WorkspaceMember:delete",
        "WorkspaceInvitation:create",
        "WorkspaceInvitation:cancel",
      ],
      admin: [
        "Workspace:update",
        "WorkspaceMember:create",
        "WorkspaceMember:update",
        "WorkspaceMember:delete",
        "WorkspaceInvitation:create",
        "WorkspaceInvitation:cancel",
      ],
      member: [],
    });
  });
});
