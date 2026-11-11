import { registerEnumType } from "@nest-boot/graphql";

import { createPermissionEnum } from "../../common/utils/create-permission-enum.util.js";
import { DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS } from "../constants/system-account.constants.js";

/** Original system credential permission values. */
export type SystemApiKeyPermission = string;
export const SystemApiKeyPermission = createPermissionEnum(
  DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS,
);
registerEnumType(SystemApiKeyPermission, { name: "SystemApiKeyPermission" });
