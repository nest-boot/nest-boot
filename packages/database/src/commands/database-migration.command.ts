import type { MigrateOptions } from "@mikro-orm/core";
import { Command, Option } from "@nest-boot/command";

import { DatabaseCommand } from "./database.command.js";

/** Creates a migration using the same entity metadata as the application. */
@Command({
  paths: [["database", "migration", "create"]],
  usage: {
    description: "Generate a migration from the application's entity metadata.",
  },
})
export class DatabaseMigrationCreateCommand extends DatabaseCommand {
  name = Option.String("-n,--name");
  directory = Option.String("-p,--path");
  blank = Option.Boolean("-b,--blank", false);
  initial = Option.Boolean("-i,--initial", false);
  dump = Option.Boolean("-d,--dump", false);
  async execute(): Promise<void> {
    const result = await this.orm.migrator.create(
      this.directory,
      this.blank,
      this.initial,
      this.name,
    );
    if (this.dump) {
      this.context.stdout.write(`${result.diff.up.join("\n")}\n`);
    }
    this.context.stdout.write(
      result.fileName
        ? `Created ${result.fileName}\n`
        : "Schema is up-to-date.\n",
    );
  }
}

/** Shared migration range and target-schema options. */
abstract class DatabaseMigrationRangeCommand extends DatabaseCommand {
  to = Option.String("-t,--to");
  from = Option.String("-f,--from");
  only = Option.String("-o,--only");
  schema = Option.String("--schema");
  protected migrationOptions(): MigrateOptions {
    if (this.only && (this.to !== undefined || this.from !== undefined)) {
      throw new Error("Use --only or --from/--to, not both.");
    }
    return {
      ...(this.to !== undefined ? { to: this.to === "0" ? 0 : this.to } : {}),
      ...(this.from !== undefined
        ? { from: this.from === "0" ? 0 : this.from }
        : {}),
      ...(this.only
        ? { migrations: this.only.split(/[, ]+/).filter(Boolean) }
        : {}),
      ...(this.schema ? { schema: this.schema } : {}),
    };
  }
}

/** Applies pending migrations. */
@Command({
  paths: [["database", "migration", "up"]],
  usage: { description: "Apply pending migrations." },
})
export class DatabaseMigrationUpCommand extends DatabaseMigrationRangeCommand {
  async execute(): Promise<void> {
    const applied = await this.orm.migrator.up(this.migrationOptions());
    this.context.stdout.write(
      `Applied ${String(applied.length)} migration(s).\n`,
    );
  }
}

/** Reverts one migration unless an explicit target is provided. */
@Command({
  paths: [["database", "migration", "down"]],
  usage: { description: "Revert a migration or migrate down to a target." },
})
export class DatabaseMigrationDownCommand extends DatabaseMigrationRangeCommand {
  async execute(): Promise<void> {
    const reverted = await this.orm.migrator.down(this.migrationOptions());
    this.context.stdout.write(
      `Reverted ${String(reverted.length)} migration(s).\n`,
    );
  }
}

/** Lists executed migration names and timestamps. */
@Command({
  paths: [["database", "migration", "list"]],
  usage: { description: "List executed migrations." },
})
export class DatabaseMigrationListCommand extends DatabaseCommand {
  schema = Option.String("--schema");
  async execute(): Promise<void> {
    const rows = await this.orm.migrator.getExecuted({ schema: this.schema });
    this.context.stdout.write(
      rows.length
        ? rows
            .map((row) => `${row.name}\t${row.executed_at.toISOString()}`)
            .join("\n") + "\n"
        : "No executed migrations.\n",
    );
  }
}

/** Lists migrations not yet applied. */
@Command({
  paths: [["database", "migration", "pending"]],
  usage: { description: "List pending migrations." },
})
export class DatabaseMigrationPendingCommand extends DatabaseCommand {
  schema = Option.String("--schema");
  async execute(): Promise<void> {
    const rows = await this.orm.migrator.getPending({ schema: this.schema });
    this.context.stdout.write(
      rows.length
        ? rows.map((row) => row.name).join("\n") + "\n"
        : "No pending migrations.\n",
    );
  }
}

/** Returns a failing exit code when entity changes need another migration. */
@Command({
  paths: [["database", "migration", "check"]],
  usage: { description: "Exit with status 1 if a new migration is needed." },
})
export class DatabaseMigrationCheckCommand extends DatabaseCommand {
  async execute(): Promise<number> {
    const changed = await this.orm.migrator.checkSchema();
    this.context.stdout.write(
      changed
        ? "Schema changes require a migration.\n"
        : "Schema is up-to-date.\n",
    );
    return changed ? 1 : 0;
  }
}

/** Drops the schema and reruns all migrations. */
@Command({
  paths: [["database", "migration", "fresh"]],
  usage: { description: "Drop the schema and rerun all migrations." },
})
export class DatabaseMigrationFreshCommand extends DatabaseCommand {
  dropDb = Option.Boolean("--drop-db", false);
  seed = Option.String("--seed");
  async execute(): Promise<void> {
    await this.orm.schema.drop({
      dropMigrationsTable: true,
      dropDb: this.dropDb,
    });
    await this.orm.migrator.up();
    if (this.seed) {
      await this.orm.seeder.seedString(this.seed);
    }
    this.context.stdout.write("Migrations reapplied.\n");
  }
}
