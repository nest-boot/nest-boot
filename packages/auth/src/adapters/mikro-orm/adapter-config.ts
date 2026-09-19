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
    // Auth IDs are strings, including UUIDs and bigint-backed Sonyflake IDs.
    supportsNumericIds: false,
    usePlural: false,
  } as const;
}
