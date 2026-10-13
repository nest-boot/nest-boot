import type { EntityMetadata, Options } from "@mikro-orm/core";

import { entities, QueueEvent } from "./entities/index.js";

/**
 * Applies the BullMQ namespace after application metadata customization.
 * @param meta - Entity metadata discovered by MikroORM.
 * @param schema - Schema used by BullMQ migrations and connections.
 */
function configureQueueMetadata(meta: EntityMetadata, schema: string): void {
  if (!entities.some((entity) => entity === meta.class)) return;
  meta.schema = schema;
  if (meta.class === QueueEvent) {
    const namespace = /^[a-z_][a-z0-9_$]*$/.test(schema)
      ? schema
      : `"${schema.replaceAll('"', '""')}"`;
    const identifier = `${namespace}.event_seq`;
    meta.properties.id.defaultRaw = `nextval('${identifier.replaceAll("'", "''")}'::regclass)`;
  }
}

type QueueDatabaseConfig = Partial<
  Pick<Options, "entities" | "entitiesTs" | "schemaGenerator" | "discovery">
>;

/**
 * Registers native BullMQ entities and composes their schema configuration.
 * BullMQ migrations must run first; application migrations manage indexes and RLS.
 * @param config - Existing runtime or CLI configuration, retained without mutation.
 * @param schema - Schema shared with BullMQ connections and migrations.
 * @returns Configuration preserving application entities, options and discovery hooks.
 */
export function withQueueDatabaseConfig<T extends object>(
  config: T & QueueDatabaseConfig,
  schema = "bullmq",
): Omit<T, keyof QueueDatabaseConfig> & Required<QueueDatabaseConfig> {
  const onMetadata = config.discovery?.onMetadata;
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
    schemaGenerator: { ...config.schemaGenerator, ignoreRoutines: true },
    discovery: {
      ...config.discovery,
      onMetadata(meta, platform) {
        const pending = onMetadata?.(meta, platform);
        if (pending)
          return pending.then(() => {
            configureQueueMetadata(meta, schema);
          });
        configureQueueMetadata(meta, schema);
      },
    },
  };
}
