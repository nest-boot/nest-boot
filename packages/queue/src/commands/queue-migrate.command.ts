import { BaseCommand, Command, Option } from "@nest-boot/command";
import { Inject } from "@nestjs/common";
import { DEFAULT_SCHEMA, isPgPool, runMigrations } from "bullmq";
import { Client } from "pg";

import { MODULE_OPTIONS_TOKEN } from "../queue.module-definition.js";
import type { QueueModuleOptions } from "../queue-module-options.interface.js";
import { loadConfigFromEnv } from "../utils/load-config-from-env.util.js";

/** Applies the PostgreSQL migrations bundled with the installed BullMQ version. */
@Command({
  paths: [["queue:migrate"]],
  usage: { description: "Apply BullMQ PostgreSQL migrations." },
})
export class QueueMigrateCommand extends BaseCommand {
  /** Override the schema configured in QueueModule. */
  schema = Option.String("--schema", {
    description: "PostgreSQL queue schema.",
  });

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: QueueModuleOptions,
  ) {
    super();
  }

  /** Applies pending migrations using one dedicated database connection. */
  async execute(): Promise<void> {
    const connection = this.options.connection ?? loadConfigFromEnv();
    if (isPgPool(connection)) {
      const client = await connection.connect();
      try {
        const version = await runMigrations(
          client,
          this.schema ?? DEFAULT_SCHEMA,
        );
        this.context.stdout.write(
          `BullMQ schema migrated to version ${String(version)}.\n`,
        );
      } finally {
        client.release();
      }
      return;
    }
    const config =
      typeof connection === "string"
        ? { connectionString: connection }
        : connection;
    const { schema, skipVersionCheck, ...clientConfig } = config;
    delete clientConfig.migrate;
    delete clientConfig.skipMigrations;
    const client = new Client(clientConfig);
    try {
      await client.connect();
      const version = await runMigrations(
        client,
        this.schema ?? schema ?? DEFAULT_SCHEMA,
        { skipVersionCheck },
      );
      this.context.stdout.write(
        `BullMQ schema migrated to version ${String(version)}.\n`,
      );
    } finally {
      await client.end();
    }
  }
}
