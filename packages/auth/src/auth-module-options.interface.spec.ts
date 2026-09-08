import { describe, expect, it } from "vitest";

import type {
  AuthModuleAccountOptions,
  AuthModuleApiKeyOptions,
  AuthModuleEmailAndPasswordOptions,
  AuthModuleEmailVerificationOptions,
  AuthModuleOAuthProvider,
  AuthModuleOptions,
  AuthModuleSessionOptions,
  AuthModuleSocialProvider,
  AuthModuleUserOptions,
  AuthModuleWorkspaceOptions,
} from "./auth-module-options.interface.js";

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
