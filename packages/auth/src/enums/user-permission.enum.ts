import { registerEnumType } from "@nest-boot/graphql";

import { DEFAULT_USER_PERMISSIONS } from "../user.constants.js";
import { createPermissionEnum } from "../utils/create-permission-enum.util.js";

/** Original user permission value, before GraphQL enum serialization. */
export type UserPermission = string;

/** User permission enum names mapped to their original permission strings. */
export const UserPermission = createPermissionEnum(DEFAULT_USER_PERMISSIONS);

registerEnumType(UserPermission, { name: "UserPermission" });
