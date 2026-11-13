import { registerEnumType } from "@nest-boot/graphql";

import { createPermissionEnum } from "../../common/utils/create-permission-enum.util.js";
import { DEFAULT_WORKSPACE_PERMISSIONS } from "../constants/workspace.constants.js";

/** Original workspace permission value, before GraphQL enum serialization. */
export type WorkspacePermission = string;

/** Workspace permission enum names mapped to their original permission strings. */
export const WorkspacePermission = createPermissionEnum(
  DEFAULT_WORKSPACE_PERMISSIONS,
);

registerEnumType(WorkspacePermission, { name: "WorkspacePermission" });
