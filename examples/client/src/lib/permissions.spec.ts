import { describe, expect, it } from "vitest";

import {
  authPermissionValues,
  workspaceApiKeyPermissionValues,
  workspacePermissionValues,
} from "./permissions";
import { AuthPermission, WorkspacePermission } from "@/gql/graphql";

describe("permission options", () => {
  it("exposes every workspace permission for members", () => {
    expect(workspacePermissionValues).toHaveLength(
      Object.values(WorkspacePermission).length,
    );
    expect(workspacePermissionValues).toEqual(
      expect.arrayContaining(Object.values(WorkspacePermission)),
    );
  });

  it("keeps workspace API-key permissions inside the mixed enum", () => {
    expect(workspaceApiKeyPermissionValues).toEqual(
      expect.arrayContaining([
        AuthPermission.WORKSPACE_UPDATE,
        AuthPermission.WORKSPACE_INVITATION_CANCEL,
      ]),
    );
    expect(workspaceApiKeyPermissionValues).not.toContain(
      AuthPermission.USER_DELETE,
    );
  });

  it("exposes user and workspace permissions for personal API keys", () => {
    expect(authPermissionValues).toHaveLength(
      Object.values(AuthPermission).length,
    );
    expect(authPermissionValues).toEqual(
      expect.arrayContaining(Object.values(AuthPermission)),
    );
  });
});
