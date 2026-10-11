import type { Options } from "@mikro-orm/core";

import { Job } from "./entities/job.entity.js";
import { JobSchemaGenerator } from "./job-schema-generator.js";

/**
 * Configures Job migration comparison without taking ownership of other BullMQ objects.
 * Spread into both runtime and CLI MikroORM options, alongside the Job entity.
 * @param schema - The same PostgreSQL schema used by BullMQ migrations and connections.
 * @returns ORM extension and entity schema configuration.
 */
export function getJobSchemaOptions(
  schema = "bullmq",
): Pick<Options, "extensions" | "discovery"> {
  return {
    extensions: [JobSchemaGenerator],
    discovery: {
      onMetadata(meta) {
        if (meta.class === Job) meta.schema = schema;
      },
    },
  };
}
