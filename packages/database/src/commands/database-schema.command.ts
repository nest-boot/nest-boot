import { Command, Option } from "@nest-boot/command";

import { DatabaseCommand } from "./database.command.js";

/** Schema commands print SQL unless --run is supplied. */
abstract class DatabaseSchemaCommand extends DatabaseCommand {
  run = Option.Boolean("-r,--run", false);
  dump = Option.Boolean("-d,--dump", false);
  schema = Option.String("--schema");
}

/** Creates tables from current entity metadata. */
@Command({
  paths: [["database", "schema", "create"]],
  usage: { description: "Print CREATE SQL, or execute it with --run." },
})
export class DatabaseSchemaCreateCommand extends DatabaseSchemaCommand {
  async execute(): Promise<void> {
    const options = { schema: this.schema };
    if (this.dump || !this.run) {
      this.context.stdout.write(
        await this.orm.schema.getCreateSchemaSQL(options),
      );
    } else {
      await this.orm.schema.create(options);
    }
  }
}

/** Updates tables from current entity metadata. */
@Command({
  paths: [["database", "schema", "update"]],
  usage: { description: "Print schema changes, or execute them with --run." },
})
export class DatabaseSchemaUpdateCommand extends DatabaseSchemaCommand {
  safe = Option.Boolean("--safe", false);
  dropTables = Option.Boolean("--drop-tables", true);
  async execute(): Promise<void> {
    const options = {
      schema: this.schema,
      safe: this.safe,
      dropTables: this.dropTables,
    };
    if (this.dump || !this.run) {
      this.context.stdout.write(
        await this.orm.schema.getUpdateSchemaSQL(options),
      );
    } else {
      await this.orm.schema.update(options);
    }
  }
}

/** Drops the schema's mapped tables. */
@Command({
  paths: [["database", "schema", "drop"]],
  usage: { description: "Print DROP SQL, or execute it with --run." },
})
export class DatabaseSchemaDropCommand extends DatabaseSchemaCommand {
  dropMigrationsTable = Option.Boolean("--drop-migrations-table", false);
  async execute(): Promise<void> {
    const options = {
      schema: this.schema,
      dropMigrationsTable: this.dropMigrationsTable,
    };
    if (this.dump || !this.run) {
      this.context.stdout.write(
        await this.orm.schema.getDropSchemaSQL(options),
      );
    } else {
      await this.orm.schema.drop(options);
    }
  }
}

/** Recreates tables from current entity metadata. */
@Command({
  paths: [["database", "schema", "fresh"]],
  usage: { description: "Drop and recreate the schema with --run." },
})
export class DatabaseSchemaFreshCommand extends DatabaseCommand {
  run = Option.Boolean("-r,--run", false);
  schema = Option.String("--schema");
  seed = Option.String("--seed");
  async execute(): Promise<void> {
    if (!this.run) {
      throw new Error("database schema fresh requires --run.");
    }
    await this.orm.schema.refresh({ schema: this.schema });
    if (this.seed) {
      await this.orm.seeder.seedString(this.seed);
    }
    this.context.stdout.write("Schema recreated.\n");
  }
}
