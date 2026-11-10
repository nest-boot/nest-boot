import { DatabaseCreateCommand } from "./database.command.js";
import {
  DatabaseMigrationCheckCommand,
  DatabaseMigrationCreateCommand,
  DatabaseMigrationDownCommand,
  DatabaseMigrationFreshCommand,
  DatabaseMigrationListCommand,
  DatabaseMigrationPendingCommand,
  DatabaseMigrationUpCommand,
} from "./database-migration.command.js";
import {
  DatabaseSchemaCreateCommand,
  DatabaseSchemaDropCommand,
  DatabaseSchemaFreshCommand,
  DatabaseSchemaUpdateCommand,
} from "./database-schema.command.js";
import {
  DatabaseSeederCreateCommand,
  DatabaseSeederRunCommand,
} from "./database-seeder.command.js";

/** Database commands discovered by the application's CommandModule. */
export const databaseCommands = [
  DatabaseCreateCommand,
  DatabaseMigrationCreateCommand,
  DatabaseMigrationUpCommand,
  DatabaseMigrationDownCommand,
  DatabaseMigrationListCommand,
  DatabaseMigrationPendingCommand,
  DatabaseMigrationCheckCommand,
  DatabaseMigrationFreshCommand,
  DatabaseSchemaCreateCommand,
  DatabaseSchemaUpdateCommand,
  DatabaseSchemaDropCommand,
  DatabaseSchemaFreshCommand,
  DatabaseSeederCreateCommand,
  DatabaseSeederRunCommand,
];
