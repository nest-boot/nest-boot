import type { AuthModuleOAuthProvider } from "../interfaces/auth-module-oauth-provider.interface.js";
import type { AuthModuleSocialProvider } from "../interfaces/auth-module-social-provider.interface.js";

/** Authentication provider accepted by {@link AuthModuleOptions.providers}. */
export type AuthModuleProvider =
  | AuthModuleSocialProvider
  | AuthModuleOAuthProvider;
