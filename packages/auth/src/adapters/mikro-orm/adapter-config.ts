import type { DBAdapterDebugLogOption } from "better-auth/adapters";

export function createMikroOrmAdapterConfig(
  debugLogs: DBAdapterDebugLogOption | undefined,
) {
  return {
    adapterId: "mikro-orm-adapter",
    adapterName: "MikroORM Adapter",
    debugLogs: debugLogs ?? false,
    disableIdGeneration: true,
    supportsArrays: true,
    supportsBooleans: true,
    supportsDates: true,
    supportsJSON: true,
    // The built-in auth entities use UUID string primary keys.
    supportsNumericIds: false,
    usePlural: false,
  } as const;
}
