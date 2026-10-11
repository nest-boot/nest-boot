import type { Options } from "@mikro-orm/core";

import { entities, QueueEvent } from "./entities/index.js";

/**
 * Configures the native BullMQ table mappings in runtime and CLI MikroORM options.
 * Register every exported Queue entity and run BullMQ migrations first.
 * Existing routines are not altered or dropped by forward comparison in any schema.
 * Keep migration snapshots enabled to exclude BullMQ functions from generated rollbacks.
 * @param schema - The same PostgreSQL schema used by BullMQ migrations and connections.
 * @returns Native ORM schema comparison and entity discovery options.
 */
export function getJobSchemaOptions(
  schema = "bullmq",
): Pick<Options, "schemaGenerator" | "discovery"> {
  return {
    schemaGenerator: { ignoreRoutines: true },
    discovery: {
      onMetadata(meta) {
        if (!entities.some((entity) => entity === meta.class)) return;
        meta.schema = schema;
        if (meta.class === QueueEvent) {
          const namespace = /^[a-z_][a-z0-9_$]*$/.test(schema)
            ? schema
            : `"${schema.replaceAll('"', '""')}"`;
          const identifier = `${namespace}.event_seq`;
          meta.properties.id.defaultRaw = `nextval('${identifier.replaceAll("'", "''")}'::regclass)`;
        }
      },
    },
  };
}
