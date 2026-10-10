import { expectTypeOf } from "vitest";

import type { AuthModuleOptions } from "../src/auth-module-options.interface.js";
import type { AuthModuleAccountOptions } from "../src/interfaces/auth-module-account-options.interface.js";
import type { AuthModuleApiKeyOptions } from "../src/interfaces/auth-module-api-key-options.interface.js";
import type { AuthModuleEmailAndPasswordOptions } from "../src/interfaces/auth-module-email-and-password-options.interface.js";
import type { AuthModuleEmailVerificationOptions } from "../src/interfaces/auth-module-email-verification-options.interface.js";
import type { AuthModuleOAuthProvider } from "../src/interfaces/auth-module-oauth-provider.interface.js";
import type { AuthModuleSessionOptions } from "../src/interfaces/auth-module-session-options.interface.js";
import type { AuthModuleSocialProvider } from "../src/interfaces/auth-module-social-provider.interface.js";
import type { AuthModuleUserOptions } from "../src/interfaces/auth-module-user-options.interface.js";
import type { AuthModuleWorkspaceOptions } from "../src/interfaces/auth-module-workspace-options.interface.js";

type HasOption<
  Options,
  Option extends PropertyKey,
> = Option extends keyof Options ? true : false;

type HasStringIndex<Options> = string extends keyof Options ? true : false;

// Checked by the auth typecheck task; excluded from runtime tests and package builds.
expectTypeOf<HasStringIndex<AuthModuleOptions>>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleAccountOptions>>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleSessionOptions>>().toEqualTypeOf<false>();
expectTypeOf<
  HasStringIndex<AuthModuleEmailAndPasswordOptions>
>().toEqualTypeOf<false>();
expectTypeOf<
  HasStringIndex<AuthModuleEmailVerificationOptions>
>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleUserOptions>>().toEqualTypeOf<false>();
expectTypeOf<
  HasStringIndex<AuthModuleWorkspaceOptions>
>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleApiKeyOptions>>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleSocialProvider>>().toEqualTypeOf<false>();
expectTypeOf<HasStringIndex<AuthModuleOAuthProvider>>().toEqualTypeOf<false>();
expectTypeOf<HasOption<AuthModuleOptions, "entities">>().toEqualTypeOf<false>();
expectTypeOf<HasOption<AuthModuleOptions, "plugins">>().toEqualTypeOf<false>();
expectTypeOf<
  HasOption<AuthModuleOptions, "secondaryStorage">
>().toEqualTypeOf<false>();
expectTypeOf<HasOption<AuthModuleOptions, "advanced">>().toEqualTypeOf<false>();
expectTypeOf<
  HasOption<AuthModuleUserOptions, "additionalFields">
>().toEqualTypeOf<false>();
expectTypeOf<
  HasOption<AuthModuleUserOptions, "modelName">
>().toEqualTypeOf<false>();
expectTypeOf<
  HasOption<AuthModuleSessionOptions, "additionalFields">
>().toEqualTypeOf<false>();
