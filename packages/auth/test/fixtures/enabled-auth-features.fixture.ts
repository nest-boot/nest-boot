import type { AuthModuleOptions } from "../../src/core/interfaces/auth-module-options.interface.js";

const snapshots = new WeakMap<AuthModuleOptions, AuthModuleOptions>();

/**
 * Explicitly opts legacy behavior tests into their administrative and credential features.
 * @param options - Test-specific authentication options and overrides.
 * @returns Options with the required features enabled, preserving explicit opt-outs.
 */
export function withAuthTestFeatures<Options extends AuthModuleOptions>(
  options: Options = {} as Options,
): AuthModuleOptions {
  const cached = snapshots.get(options);
  if (cached) {
    return cached;
  }
  const enabled = {
    ...options,
    admin: { enabled: true, ...options.admin },
    apiKey: {
      ...options.apiKey,
      enabled: options.apiKey?.enabled ?? true,
      system: { enabled: true, ...options.apiKey?.system },
      user: { enabled: true, ...options.apiKey?.user },
      workspace: {
        enabled: options.workspace?.enabled === true,
        ...options.apiKey?.workspace,
      },
    },
  };
  snapshots.set(options, enabled);
  return enabled;
}
