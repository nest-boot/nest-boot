import { registerEnumType } from "@nest-boot/graphql";

import { DEFAULT_WORKSPACE_ROLES } from "../workspace.constants.js";

/** Original workspace role value; the catalog is configured at runtime. */
export type WorkspaceRole = string;

/** Workspace role values populated from AuthModule configuration before schema generation. */
export const WorkspaceRole: Record<string, string> = Object.fromEntries(
  Object.keys(DEFAULT_WORKSPACE_ROLES).map((role) => [
    role.toUpperCase(),
    role,
  ]),
);

registerEnumType(WorkspaceRole, { name: "WorkspaceRole" });
