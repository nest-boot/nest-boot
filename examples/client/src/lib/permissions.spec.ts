import { describe, expect, it } from "vitest";

import {
  authPermissionValues,
  isAuthPermission,
  isUserPermission,
  isWorkspacePermission,
  userPermissionValues,
  workspaceApiKeyPermissionValues,
  workspacePermissionValues,
} from "./permissions";

describe("permission options", () => {
  it("exposes the workspace permission catalog", () => {
    expect(workspacePermissionValues).toEqual([
      "Workspace:update",
      "Workspace:delete",
      "WorkspaceMember:create",
      "WorkspaceMember:update",
      "WorkspaceMember:delete",
      "WorkspaceInvitation:create",
      "WorkspaceInvitation:cancel",
    ]);
  });

  it("keeps workspace API-key permissions inside the mixed catalog", () => {
    expect(workspaceApiKeyPermissionValues).toContain("Workspace:update");
    expect(workspaceApiKeyPermissionValues).toContain(
      "WorkspaceInvitation:cancel",
    );
    expect(workspaceApiKeyPermissionValues).not.toContain("User:delete");
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
    expect(isUserPermission("User:get")).toBe(true);
    expect(isWorkspacePermission("Workspace:update")).toBe(true);
    expect(isAuthPermission("custom:unknown")).toBe(false);
  });
});
