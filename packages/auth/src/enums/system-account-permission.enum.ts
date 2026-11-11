import { registerEnumType } from "@nest-boot/graphql";

import { DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS } from "../system-account.constants.js";
import { createPermissionEnum } from "../utils/create-permission-enum.util.js";

/** Stored permission value for a platform system account and its keys. */
export type SystemAccountPermission = string;
/** GraphQL names for explicit platform permission grants. */
export const SystemAccountPermission = createPermissionEnum(
  DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS,
);
registerEnumType(SystemAccountPermission, { name: "SystemAccountPermission" });
