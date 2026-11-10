import { MikroORM } from "@mikro-orm/core";
import { BaseCommand, Command } from "@nest-boot/command";
import { Inject } from "@nestjs/common";

/** Base class for commands using the application's initialized ORM. */
export abstract class DatabaseCommand extends BaseCommand {
  constructor(@Inject(MikroORM) protected readonly orm: MikroORM) {
    super();
  }
}

/** Creates the configured database if it does not exist. */
@Command({
  paths: [["database:create"]],
  usage: { description: "Create the configured database if needed." },
})
export class DatabaseCreateCommand extends DatabaseCommand {
  async execute(): Promise<void> {
    await this.orm.schema.ensureDatabase();
    this.context.stdout.write("Database is ready.\n");
  }
}
