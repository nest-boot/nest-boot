import { BaseCommand, Command, Option } from '@nest-boot/command';

/** Demonstrates typed command arguments in the shared application module. */
@Command({
  paths: [['greet']],
  usage: { description: 'Greet a user from the example application.' },
})
export class GreetCommand extends BaseCommand {
  name = Option.String({ required: true });
  loud = Option.Boolean('--loud', false);

  /**
   * Prints the greeting to the command's configured output stream.
   * @returns Completion of the greeting.
   */
  execute(): Promise<void> {
    const name = this.loud ? this.name.toUpperCase() : this.name;
    this.context.stdout.write(`Hello ${name}!\n`);
    return Promise.resolve();
  }
}
