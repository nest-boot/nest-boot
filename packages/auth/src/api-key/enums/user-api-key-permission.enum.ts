import { registerEnumType } from "@nest-boot/graphql";

import { createPermissionEnum } from "../../common/utils/create-permission-enum.util.js";
import { DEFAULT_USER_PERMISSIONS } from "../../core/constants/user.constants.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../../workspace/constants/workspace.constants.js";

/** Original API-key permission value, before GraphQL enum serialization. */
export type UserApiKeyPermission = string;

/** API-key permission enum names mapped to their original permission strings. */
export const UserApiKeyPermission = createPermissionEnum([
  ...DEFAULT_USER_PERMISSIONS,
  ...DEFAULT_WORKSPACE_PERMISSIONS,
]);

registerEnumType(UserApiKeyPermission, { name: "UserApiKeyPermission" });
