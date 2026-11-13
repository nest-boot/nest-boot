import { Command, Option } from "@nest-boot/command";

import { DatabaseCommand } from "./database.command.js";

/** Executes the configured default seeder or a named seeder. */
@Command({
  paths: [["database", "seeder", "run"]],
  usage: { description: "Run the default seeder, or select one with --class." },
})
export class DatabaseSeederRunCommand extends DatabaseCommand {
  className = Option.String("-c,--class");
  async execute(): Promise<void> {
    const name =
      this.className ??
      this.orm.config.get("seeder").defaultSeeder ??
      "DatabaseSeeder";
    await this.orm.seeder.seedString(name);
    this.context.stdout.write(`Executed ${name}.\n`);
  }
}

/** Creates a new seeder class. */
@Command({
  paths: [["database", "seeder", "create"]],
  usage: { description: "Create a seeder class." },
})
export class DatabaseSeederCreateCommand extends DatabaseCommand {
  name = Option.String({ required: true });
  async execute(): Promise<void> {
    const name =
      this.name
        .replace(/seeder$/i, "")
        .split(/[-_ ]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("") + "Seeder";
    const path = await this.orm.seeder.create(name);
    this.context.stdout.write(`Created ${path}\n`);
  }
}
