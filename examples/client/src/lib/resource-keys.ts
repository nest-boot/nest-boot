export const userApiKeysResourceKey = ["user", "api-keys"] as const;

export const getWorkspaceApiKeysResourceKey = (workspaceId: string) =>
  ["workspaces", workspaceId, "api-keys"] as const;

export const adminUsersResourceKey = ["admin", "users"] as const;

export const getMembersResourceKey = (workspaceId: string) =>
  ["workspaces", workspaceId, "members"] as const;

export const workspacesResourceKey = ["user", "workspaces"] as const;
