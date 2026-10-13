import { BaseCommand, Command, Option } from "@nest-boot/command";

import { GreetingService } from "./greeting.service.js";

@Command({
  paths: [["hello"]],
  usage: { description: "Test greeting command." },
})
export class HelloCommand extends BaseCommand {
  name = Option.String({ required: true });
  loud = Option.Boolean("--loud", false);
  prefix = Option.String("--prefix");

  constructor(private readonly greeting: GreetingService) {
    super();
  }

  /** Executes the greeting using the injected service and typed options. */
  async execute(): Promise<void> {
    const { punctuation } = await import("./punctuation.js");
    const name: string = this.name;
    const loud: boolean = this.loud;
    const prefix: string | undefined = this.prefix;
    this.context.stdout.write(
      `${prefix ?? this.greeting.prefix}:${this.greeting.format(name, loud)}${punctuation}\n`,
    );
  }
}
