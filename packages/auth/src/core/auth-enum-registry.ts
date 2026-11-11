import type { OnModuleDestroy } from "@nestjs/common";

import { SystemAccountPermission } from "../admin/enums/system-account-permission.enum.js";
import { SystemApiKeyPermission } from "../api-key/enums/system-api-key-permission.enum.js";
import { UserApiKeyPermission } from "../api-key/enums/user-api-key-permission.enum.js";
import { WorkspaceApiKeyPermission } from "../api-key/enums/workspace-api-key-permission.enum.js";
import { resolveApiKeyPermissionCatalog } from "../api-key/utils/api-key-permissions.util.js";
import { createPermissionEnum } from "../common/utils/create-permission-enum.util.js";
import { resolveAuthCatalog } from "../common/utils/resolve-auth-catalog.util.js";
import { WorkspacePermission } from "../workspace/enums/workspace-permission.enum.js";
import { WorkspaceRole } from "../workspace/enums/workspace-role.enum.js";
import { UserPermission } from "./enums/user-permission.enum.js";
import { UserRole } from "./enums/user-role.enum.js";
import type { AuthModuleOptions } from "./interfaces/auth-module-options.interface.js";
import { resolveAuthFeatures } from "./utils/resolve-auth-features.util.js";

let activeSignature: string | undefined;
let activeApplications = 0;

/**
 * Initializes Nest's process-wide enum metadata before schema generation.
 * @internal
 */
export class AuthEnumRegistry implements OnModuleDestroy {
  private released = false;

  constructor(options: AuthModuleOptions) {
    const users = resolveAuthCatalog(options, "user").permissions;
    const workspaces = resolveAuthCatalog(options, "workspace").permissions;
    const roleValues = (roles: object) =>
      Object.fromEntries(
        Object.keys(roles).map((role) => [
          role.replaceAll("-", "_").toUpperCase(),
          role,
        ]),
      );
    const enums = [
      [
        SystemApiKeyPermission,
        createPermissionEnum(
          resolveApiKeyPermissionCatalog(options, "systemAccount").permissions,
        ),
      ],
      [
        SystemAccountPermission,
        createPermissionEnum(
          resolveApiKeyPermissionCatalog(options, "systemAccount").permissions,
        ),
      ],
      [UserRole, roleValues(resolveAuthCatalog(options, "user").roles)],
      [
        WorkspaceRole,
        roleValues(resolveAuthCatalog(options, "workspace").roles),
      ],
      [UserPermission, createPermissionEnum(users)],
      [WorkspacePermission, createPermissionEnum(workspaces)],
      // Output enums must also serialize stored grants removed from the allowlist.
      // Services enforce the current allowlist when creating or updating a key.
      [
        UserApiKeyPermission,
        createPermissionEnum(
          resolveApiKeyPermissionCatalog(options, "user").permissions,
        ),
      ],
      [
        WorkspaceApiKeyPermission,
        createPermissionEnum(
          resolveApiKeyPermissionCatalog(options, "member").permissions,
        ),
      ],
    ] as const;
    const signature = JSON.stringify([
      resolveAuthFeatures(options),
      enums.map(([, values]) =>
        Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ]);
    if (activeApplications > 0 && activeSignature !== signature) {
      throw new Error(
        "Concurrent AuthModule applications must use the same role and permission enums",
      );
    }
    for (const [target, values] of enums) {
      for (const key of Object.keys(target)) {
        Reflect.deleteProperty(target, key);
      }
      Object.assign(target, values);
    }
    activeSignature = signature;
    activeApplications++;
  }

  onModuleDestroy(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    activeApplications--;
  }
}
