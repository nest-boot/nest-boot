import { BaseCommand, Command } from "@nest-boot/command";

/** Ordinary application command used to confirm scheduled handlers stay idle. */
@Command({ paths: [["ping"]] })
export class PingCommand extends BaseCommand {
  async execute(): Promise<void> {
    await Promise.resolve();
    this.context.stdout.write("PONG\n");
  }
}
