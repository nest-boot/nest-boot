import {
  BaseCommand,
  Command,
  CommandFactory,
  CommandModule,
  Option,
} from "@nest-boot/command";
import { RequestContext } from "@nest-boot/request-context";
import { Injectable, Module } from "@nestjs/common";

@Injectable()
class GreetingService {
  format(name: string, loud: boolean): string {
    if (RequestContext.current().type !== "command")
      throw new Error("Missing command context");
    return loud ? name.toUpperCase() : name;
  }
}

@Command({ paths: [["hello"]], usage: { description: "Packed CLI probe." } })
class HelloCommand extends BaseCommand {
  name = Option.String({ required: true });
  loud = Option.Boolean("--loud", false);
  prefix = Option.String("--prefix");

  constructor(private readonly greeting: GreetingService) {
    super();
  }

  async execute(): Promise<void> {
    const name: string = this.name;
    const loud: boolean = this.loud;
    const prefix: string | undefined = this.prefix;
    this.context.stdout.write(
      `${prefix ?? "Hello"}:${this.greeting.format(name, loud)}\n`,
    );
    await Promise.resolve();
  }
}

@Module({ providers: [GreetingService, HelloCommand] })
class GreetingModule {}

@Module({
  imports: [CommandModule, GreetingModule],
})
class AppModule {}

/** Boots the consumer application and executes its command. */
async function bootstrap() {
  await CommandFactory.run(AppModule);
}

void bootstrap();
