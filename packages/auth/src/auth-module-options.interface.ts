import type { AuthModuleAccountOptions } from "./interfaces/auth-module-account-options.interface.js";
import type { AuthModuleApiKeyOptions } from "./interfaces/auth-module-api-key-options.interface.js";
import type { AuthModuleEmailAndPasswordOptions } from "./interfaces/auth-module-email-and-password-options.interface.js";
import type { AuthModuleEmailVerificationOptions } from "./interfaces/auth-module-email-verification-options.interface.js";
import type { AuthModuleMiddlewareOptions } from "./interfaces/auth-module-middleware-options.interface.js";
import type { AuthModuleSessionOptions } from "./interfaces/auth-module-session-options.interface.js";
import type { AuthModuleUserOptions } from "./interfaces/auth-module-user-options.interface.js";
import type { AuthModuleWorkspaceOptions } from "./interfaces/auth-module-workspace-options.interface.js";
import type { AuthMaybePromise } from "./types/auth-maybe-promise.type.js";
import type { AuthModuleProvider } from "./types/auth-module-provider.type.js";
import type {
  DEFAULT_USER_PERMISSIONS,
  DEFAULT_USER_ROLES,
} from "./user.constants.js";
import type {
  DEFAULT_WORKSPACE_PERMISSIONS,
  DEFAULT_WORKSPACE_ROLES,
} from "./workspace.constants.js";

/** Configuration options for the AuthModule. */
export interface AuthModuleOptions<
  UserPermission extends string = string,
  WorkspacePermission extends string = string,
  UserRole extends string = string,
  WorkspaceRole extends string = string,
> {
  /** Application name used by authentication flows. */
  appName?: string;
  /** Public application URL used to construct authentication callbacks. */
  baseURL?: string;
  /** Base path for the auth API endpoints. */
  basePath?: string;
  /** Secret used for authentication signing and encryption. */
  secret?: string;
  /** Origins permitted to initiate browser authentication requests. */
  trustedOrigins?:
    | string[]
    | ((request?: Request) => AuthMaybePromise<(string | null | undefined)[]>);

  /** OAuth account persistence and state-validation options. */
  account?: AuthModuleAccountOptions;

  /** Session lifecycle and Cookie cache options. */
  session?: AuthModuleSessionOptions;

  /** Email and password authentication options. */
  emailAndPassword?: AuthModuleEmailAndPasswordOptions;

  /** User lifecycle, roles, permissions, and authorization ability. */
  user?: AuthModuleUserOptions<
    UserPermission | (typeof DEFAULT_USER_PERMISSIONS)[number],
    UserRole | keyof typeof DEFAULT_USER_ROLES
  >;

  /** Email verification delivery and lifecycle options. */
  emailVerification?: AuthModuleEmailVerificationOptions;

  /** Workspace lifecycle and invitation-delivery options. */
  workspace?: AuthModuleWorkspaceOptions<
    WorkspacePermission | (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number],
    WorkspaceRole | keyof typeof DEFAULT_WORKSPACE_ROLES
  >;

  /** API-key permission defaults and grant limits. */
  apiKey?: AuthModuleApiKeyOptions<
    NoInfer<
      | UserPermission
      | WorkspacePermission
      | (typeof DEFAULT_USER_PERMISSIONS)[number]
      | (typeof DEFAULT_WORKSPACE_PERMISSIONS)[number]
    >
  >;

  /** Built-in social and custom OAuth providers, identified by `id`. */
  providers?: readonly AuthModuleProvider[];
  /** Middleware registration options. */
  middleware?: AuthModuleMiddlewareOptions;
}
