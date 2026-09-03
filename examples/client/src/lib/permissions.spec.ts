import { describe, expect, it } from "vitest";

import {
  authPermissionValues,
  isAuthPermission,
  isUserPermission,
  isWorkspacePermission,
  userPermissionValues,
  workspaceApiKeyPermissionValues,
  workspaceMemberCan,
  workspacePermissionValues,
} from "./permissions";

describe("permission options", () => {
  it("exposes the workspace permission catalog", () => {
    expect(workspacePermissionValues).toEqual([
      "workspace:update",
      "workspace:delete",
      "workspaceMember:create",
      "workspaceMember:update",
      "workspaceMember:delete",
      "workspaceInvitation:create",
      "workspaceInvitation:cancel",
    ]);
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("workspace:update");
    expect(workspaceApiKeyPermissionValues).toContain(
      "workspaceInvitation:cancel",
    );
    expect(workspaceApiKeyPermissionValues).not.toContain("user:delete");
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toHaveLength(
      userPermissionValues.length + workspacePermissionValues.length,
    );
    expect(authPermissionValues).toEqual([
      ...userPermissionValues,
      ...workspacePermissionValues,
    ]);
  });

  it("narrows server strings against the local permission catalog", () => {
    expect(isUserPermission("user:get")).toBe(true);
    expect(isWorkspacePermission("workspace:update")).toBe(true);
    expect(isAuthPermission("custom:unknown")).toBe(false);
  });

  it("mirrors owner, admin, and member workspace permissions", () => {
    expect(
      workspaceMemberCan(
        { permissions: [], roles: ["owner"] },
        "workspace:delete",
      ),
    ).toBe(true);
    expect(
      workspaceMemberCan(
        {
          permissions: ["workspace:delete"],
          roles: ["admin"],
        },
        "workspace:delete",
      ),
    ).toBe(true);
    expect(
      workspaceMemberCan(
        {
          permissions: ["workspaceMember:update"],
          roles: ["member"],
        },
        "workspaceMember:update",
      ),
    ).toBe(true);
  });
});
