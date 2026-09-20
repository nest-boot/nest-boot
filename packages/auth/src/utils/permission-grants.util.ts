import { ForbiddenException } from "@nestjs/common";

import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { resolveRequestPermissions } from "./resolve-request-permissions.util.js";

/** Checks delegation against the shared, credential-limited permission snapshot. @internal */
export function canGrantPermissions(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
  requested: readonly string[],
): boolean {
  const allowed = new Set(resolveRequestPermissions(options)[scope]);
  return requested.every((permission) => allowed.has(permission));
}

/** Rejects delegation outside the caller's effective permission source. @internal */
export function assertCanGrantPermissions(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
  requested: readonly string[],
): void {
  assertPermissionCeiling(
    requested,
    resolveRequestPermissions(options)[scope],
    `${scope === "user" ? "User" : "Workspace"} permissions exceed issuer permissions`,
  );
}

/** Rejects access to or delegation of keys broader than the authenticating credential. @internal */
export function assertApiKeyPermissionCeiling(
  options: AuthModuleOptions,
  requested: readonly string[],
): void {
  const ceiling = resolveRequestPermissions(options).apiKey;
  if (ceiling !== null)
    assertPermissionCeiling(
      requested,
      ceiling,
      "API key permissions exceed authenticating API key permissions",
    );
}

/** Shared subset check for configured, owner, and credential permission ceilings. @internal */
export function assertPermissionCeiling(
  requested: readonly string[],
  allowed: readonly string[],
  message: string,
): void {
  const permissions = new Set(allowed);
  const excessive = requested.filter(
    (permission) => !permissions.has(permission),
  );
  if (excessive.length)
    throw new ForbiddenException(`${message}: ${excessive.join(", ")}`);
}
