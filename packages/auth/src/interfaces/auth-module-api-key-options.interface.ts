import type { AuthModuleApiKeyScopeOptions } from "./auth-module-api-key-scope-options.interface.js";

/** Independent permission defaults and ceilings for each API-key owner type. */
export interface AuthModuleApiKeyOptions<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
> {
  /** User keys may carry both user and workspace permissions, limited again by their owner's grants at use time. */
  user?: AuthModuleApiKeyScopeOptions<UserPermission | WorkspacePermission>;
  /** Workspace keys only carry workspace permissions; creating an invitation additionally requires a user identity. */
  workspace?: AuthModuleApiKeyScopeOptions<WorkspacePermission>;
}
