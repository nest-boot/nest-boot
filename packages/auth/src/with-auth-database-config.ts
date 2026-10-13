import type { Options } from "@mikro-orm/core";

import { entities } from "./entities/index.js";

type EntityConfig = Partial<Pick<Options, "entities" | "entitiesTs">>;

/**
 * Adds Auth entities to an application's runtime and CLI database configuration.
 * @param config - Existing configuration, retained without mutation.
 * @returns Configuration with deduplicated authentication entity registrations.
 */
export function withAuthDatabaseConfig<T extends object>(
  config: T & EntityConfig,
): Omit<T, keyof EntityConfig> & Required<EntityConfig> {
  return {
    ...config,
    entities: [...new Set([...(config.entities ?? []), ...entities])],
    entitiesTs: [
      ...new Set([
        ...(config.entitiesTs?.length
          ? config.entitiesTs
          : (config.entities ?? [])),
        ...entities,
      ]),
    ],
  };
}
