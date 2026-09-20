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
import { resolveApiKeyPermissionCatalog } from "../utils/api-key-permissions.util.js";
import { createPermissionEnum } from "../utils/create-permission-enum.util.js";
import { resolveAuthCatalog } from "../utils/resolve-auth-catalog.util.js";

let activeSignature: string | undefined;
let activeApplications = 0;

/** @internal Initializes Nest's process-wide enum metadata before schema generation. */
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
          resolveApiKeyPermissionCatalog(options, "workspace").permissions,
        ),
      ],
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
