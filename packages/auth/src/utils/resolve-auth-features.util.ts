import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS } from "../system-account.constants.js";

/**
 * Resolves feature dependencies before provider, schema and entity registration.
 * @param options - Immutable authentication configuration.
 * @returns Enabled identity and credential features.
 */
export function resolveAuthFeatures(
  options: Pick<AuthModuleOptions, "admin" | "workspace" | "apiKey">,
) {
  const admin = options.admin?.enabled === true;
  const workspace = options.workspace?.enabled === true;
  const keys = options.apiKey?.enabled === true;
  const userApiKey = keys && options.apiKey?.user?.enabled === true;
  const workspaceApiKey =
    keys && workspace && options.apiKey?.workspace?.enabled === true;
  const systemAccountApiKey = keys && options.apiKey?.system?.enabled === true;
  const systemAccountApiKeyManagement = admin && systemAccountApiKey;
  return {
    admin,
    workspace,
    systemAccount: admin || systemAccountApiKey,
    userApiKey,
    workspaceApiKey,
    systemAccountApiKey,
    systemAccountApiKeyManagement,
    apiKey: userApiKey || workspaceApiKey || systemAccountApiKey,
    apiKeyGraphQL:
      userApiKey || workspaceApiKey || systemAccountApiKeyManagement,
  };
}

/**
 * Keeps stored enum values serializable while suppressing grants for disabled features.
 * @param options - Authentication configuration.
 * @param scope - Identity scope granting the permission.
 * @param permission - Configured permission value.
 * @param systemAccount - Whether the grants belong to a machine principal.
 * @returns Whether the feature implementing this permission is active.
 */
export function isAuthPermissionEnabled(
  options: AuthModuleOptions,
  scope: "user" | "workspace",
  permission: string,
  systemAccount = false,
): boolean {
  const features = resolveAuthFeatures(options);
  if (systemAccount) {
    return (
      features.systemAccountApiKey &&
      DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS.some(
        (allowed) => allowed === permission,
      ) &&
      (features.workspace || !permission.startsWith("workspace:"))
    );
  }
  if (scope === "workspace" && !features.workspace) {
    return false;
  }
  if (permission.startsWith("user-api-key:")) {
    return features.userApiKey;
  }
  if (permission.startsWith("member-api-key:")) {
    return features.workspaceApiKey;
  }
  if (permission.startsWith("system-account-api-key:")) {
    return features.systemAccountApiKeyManagement;
  }
  if (
    permission.startsWith("system-account:") ||
    permission.startsWith("user:") ||
    permission.startsWith("session:")
  ) {
    return features.admin;
  }
  if (permission.startsWith("workspace:")) {
    return (
      features.workspace &&
      (scope === "workspace" ||
        permission === "workspace:create" ||
        features.admin)
    );
  }
  return true;
}
