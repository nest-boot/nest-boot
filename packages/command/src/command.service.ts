import { Global, Injectable } from "@nestjs/common";
import yargs, { CommandModule } from "yargs";

@Global()
@Injectable()
export class CommandService {
  private yargs = yargs;

  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  initialize(metadatas: CommandModule[]): void {
    this.yargs
      .scriptName("nest-boot")
      .demandCommand(1)
      .help("h")
      .alias("h", "help")
      .alias("v", "version")
      .strict();

    metadatas.forEach((command) => {
      this.yargs.command(command);
    });
  }

  exec(): void {
    // eslint-disable-next-line no-unused-expressions
    this.yargs.argv;
  }

  run(): void {
    this.running = true;
  }

  exit(code?: number): void {
    this.running = false;
    process.exit(code);
  }
}
