import type { DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS } from "../system-account.constants.js";
import type { AuthModuleApiKeyScopeOptions } from "./auth-module-api-key-scope-options.interface.js";

/** Independent credential and permission defaults and ceilings for each API-key owner type. */
export interface AuthModuleApiKeyOptions<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> {
  /** Credential defaults and ceiling for independent system accounts. Empty key grants mean no access. */
  systemAccount?: AuthModuleApiKeyScopeOptions<
    (typeof DEFAULT_SYSTEM_ACCOUNT_PERMISSIONS)[number]
  >;
  /** User keys may carry both user and workspace permissions, limited again by their owner's grants at use time. */
  user?: AuthModuleApiKeyScopeOptions<UserPermission | WorkspacePermission>;
  /** Requires `workspace.enabled: true`. Member keys only carry workspace permissions; creating an invitation additionally requires a user identity. */
  member?: AuthModuleApiKeyScopeOptions<WorkspacePermission>;
}
