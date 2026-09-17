import { describe, expect, it } from "vitest";

import type { AuthModuleOptions } from "./auth-module-options.interface.js";
import type { AuthModuleAccountOptions } from "./interfaces/auth-module-account-options.interface.js";
import type { AuthModuleApiKeyOptions } from "./interfaces/auth-module-api-key-options.interface.js";
import type { AuthModuleEmailAndPasswordOptions } from "./interfaces/auth-module-email-and-password-options.interface.js";
import type { AuthModuleEmailVerificationOptions } from "./interfaces/auth-module-email-verification-options.interface.js";
import type { AuthModuleOAuthProvider } from "./interfaces/auth-module-oauth-provider.interface.js";
import type { AuthModuleSessionOptions } from "./interfaces/auth-module-session-options.interface.js";
import type { AuthModuleSocialProvider } from "./interfaces/auth-module-social-provider.interface.js";
import type { AuthModuleUserOptions } from "./interfaces/auth-module-user-options.interface.js";
import type { AuthModuleWorkspaceOptions } from "./interfaces/auth-module-workspace-options.interface.js";

type HasOption<
  Options,
  Option extends PropertyKey,
> = Option extends keyof Options ? true : false;

type HasStringIndex<Options> = string extends keyof Options ? true : false;

describe("AuthModuleOptions", () => {
  it("should expose only explicitly owned option fields", () => {
    expect(false satisfies HasStringIndex<AuthModuleOptions>).toBe(false);
    expect(false satisfies HasStringIndex<AuthModuleAccountOptions>).toBe(
      false,
    );
    expect(false satisfies HasStringIndex<AuthModuleSessionOptions>).toBe(
      false,
    );
    expect(
      false satisfies HasStringIndex<AuthModuleEmailAndPasswordOptions>,
    ).toBe(false);
    expect(
      false satisfies HasStringIndex<AuthModuleEmailVerificationOptions>,
    ).toBe(false);
    expect(false satisfies HasStringIndex<AuthModuleUserOptions>).toBe(false);
    expect(false satisfies HasStringIndex<AuthModuleWorkspaceOptions>).toBe(
      false,
    );
    expect(false satisfies HasStringIndex<AuthModuleApiKeyOptions>).toBe(false);
    expect(false satisfies HasStringIndex<AuthModuleSocialProvider>).toBe(
      false,
    );
    expect(false satisfies HasStringIndex<AuthModuleOAuthProvider>).toBe(false);

    expect(false satisfies HasOption<AuthModuleOptions, "entities">).toBe(
      false,
    );
    expect(false satisfies HasOption<AuthModuleOptions, "plugins">).toBe(false);
    expect(
      false satisfies HasOption<AuthModuleOptions, "secondaryStorage">,
    ).toBe(false);
    expect(false satisfies HasOption<AuthModuleOptions, "advanced">).toBe(
      false,
    );
    expect(
      false satisfies HasOption<AuthModuleUserOptions, "additionalFields">,
    ).toBe(false);
    expect(false satisfies HasOption<AuthModuleUserOptions, "modelName">).toBe(
      false,
    );
    expect(
      false satisfies HasOption<AuthModuleSessionOptions, "additionalFields">,
    ).toBe(false);
  });
});
