import { registerEnumType } from "@nest-boot/graphql";

import { DEFAULT_USER_PERMISSIONS } from "../user.constants.js";
import { createPermissionEnum } from "../utils/create-permission-enum.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../workspace.constants.js";

/** Stored permission value shared by all API-key output objects. */
export type ApiKeyPermission = string;

/** Serialization catalog; owner-specific services enforce grantability. */
export const ApiKeyPermission = createPermissionEnum([
  ...DEFAULT_USER_PERMISSIONS,
  ...DEFAULT_WORKSPACE_PERMISSIONS,
]);

registerEnumType(ApiKeyPermission, { name: "ApiKeyPermission" });
