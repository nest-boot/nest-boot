import { registerEnumType } from "@nest-boot/graphql";

import { createPermissionEnum } from "../utils/create-permission-enum.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";

/** Original API-key permission value, before GraphQL enum serialization. */
export type WorkspaceApiKeyPermission = string;

/** API-key permission enum names mapped to their original permission strings. */
export const WorkspaceApiKeyPermission = createPermissionEnum([
  ...DEFAULT_WORKSPACE_PERMISSIONS,
]);

registerEnumType(WorkspaceApiKeyPermission, {
  name: "WorkspaceApiKeyPermission",
});
