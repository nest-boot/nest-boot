import { registerEnumType } from "@nest-boot/graphql";

import { createPermissionEnum } from "../../common/utils/create-permission-enum.util.js";
import { DEFAULT_USER_PERMISSIONS } from "../constants/user.constants.js";

/** Original user permission value, before GraphQL enum serialization. */
export type UserPermission = string;

/** User permission enum names mapped to their original permission strings. */
export const UserPermission = createPermissionEnum(DEFAULT_USER_PERMISSIONS);

registerEnumType(UserPermission, { name: "UserPermission" });
