import type { OnModuleDestroy } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import {
  UserApiKeyPermission,
  UserPermission,
  UserRole,
  WorkspaceApiKeyPermission,
  WorkspacePermission,
  WorkspaceRole,
} from "../enums/index.js";
import {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "../user.constants.js";
import { createPermissionEnum } from "../utils/create-permission-enum.util.js";
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "../workspace.constants.js";

let activeSignature: string | undefined;
let activeApplications = 0;

/** @internal Initializes Nest's process-wide enum metadata before schema generation. */
export class AuthEnumRegistry implements OnModuleDestroy {
  private released = false;

  constructor(options: AuthModuleOptions) {
    const users = options.user?.permissions?.length
      ? options.user.permissions
      : DEFAULT_USER_PERMISSIONS;
    const workspaces = options.workspace?.permissions?.length
      ? options.workspace.permissions
      : DEFAULT_WORKSPACE_PERMISSIONS;
    const roleValues = (roles: object) =>
      Object.fromEntries(
        Object.keys(roles).map((role) => [
          role.replaceAll("-", "_").toUpperCase(),
          role,
        ]),
      );
    const enums = [
      [UserRole, roleValues(options.user?.roles ?? DEFAULT_USER_ROLES)],
      [
        WorkspaceRole,
        roleValues(options.workspace?.roles ?? DEFAULT_WORKSPACE_ROLES),
      ],
      [UserPermission, createPermissionEnum(users)],
      [WorkspacePermission, createPermissionEnum(workspaces)],
      // Output enums must also serialize stored grants removed from the allowlist.
      // Services enforce the current allowlist when creating or updating a key.
      [UserApiKeyPermission, createPermissionEnum([...users, ...workspaces])],
      [WorkspaceApiKeyPermission, createPermissionEnum(workspaces)],
    ] as const;
    const signature = JSON.stringify(
      enums.map(([, values]) =>
        Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
    if (activeApplications > 0 && activeSignature !== signature) {
      throw new Error(
        "Concurrent AuthModule applications must use the same role and permission enums",
      );
    }
    for (const [target, values] of enums) {
      for (const key of Object.keys(target))
        Reflect.deleteProperty(target, key);
      Object.assign(target, values);
    }
    activeSignature = signature;
    activeApplications++;
  }

  onModuleDestroy(): void {
    if (this.released) return;
    this.released = true;
    activeApplications--;
  }
}
