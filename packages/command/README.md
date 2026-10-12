# @nest-boot/command

Type-safe NestJS commands powered by Clipanion 4. Run `nb` from your application directory to execute its CLI entry script.

## Quick start

```bash
pnpm add @nest-boot/command @nest-boot/request-context
```

```ts
import { BaseCommand, Command, Option } from "@nest-boot/command";

@Command({
  paths: [["greet"], ["hello", "user"]],
  usage: { description: "Greet a user." },
})
export class GreetCommand extends BaseCommand {
  name = Option.String({ required: true }); // string
  loud = Option.Boolean("--loud", false); // boolean
  prefix = Option.String("--prefix"); // string | undefined

  async execute(): Promise<void> {
    const name = this.loud ? this.name.toUpperCase() : this.name;
    this.context.stdout.write(`${this.prefix ?? "Hello"} ${name}!\n`);
  }
}
```

```ts
// src/app/app.module.ts
import { CommandModule } from "@nest-boot/command";
import { Module } from "@nestjs/common";

import { GreetCommand } from "../greet.command.js";

@Module({ providers: [GreetCommand] })
class GreetingModule {}

@Module({ imports: [CommandModule, GreetingModule] })
export class AppModule {}
```

```ts
// src/cli.ts
import { CommandFactory } from "@nest-boot/command";

import { AppModule } from "./app/app.module.js";

async function bootstrap() {
  await CommandFactory.run(AppModule);
}

void bootstrap();
```

```bash
pnpm exec nb greet Alice --loud
pnpm exec nb --help
```

Modules register command classes in `providers`; the CLI discovers commands across the imported module tree and retains Nest dependency injection. Commands and dependencies must be singletons. Parameter types are inferred by `Option` helpers. Commands implement `async execute()` and can return an exit code.

Development prefers `src/cli.ts`; production (`NODE_ENV=production`) prefers `dist/cli.js`. The entry calls `CommandFactory.run(AppModule)`, which sets `process.exitCode` internally; it needs no exports. Call the factory once from the CLI bootstrap. Every command runs in an independent `RequestContext` of type `"command"`, including registered context middleware. `CommandModule` imports `RequestContextModule` automatically. Application initialization and shutdown hooks run normally. TypeScript loading preserves decorator metadata and supports `.js` imports, tsconfig paths and baseUrl, and TSX dependencies using the project JSX settings. Execution always closes the Nest application context.

Use `CommandFactory.run(AppModule, { args })` for programmatic command execution; it returns an exit code without exiting the process. `runCli({ cwd, production })` executes the project entry script, which calls the factory to bootstrap the application and set its exit code.

`RequestContext.get(token)` falls back to Nest singleton providers; unavailable or scoped providers return `undefined`.

After publication, `npm install -g @nest-boot/command` provides a global `nb` executable. Run it from the application directory; the project still installs this package and its peers and provides its own CLI entry and module registration.

The repository example is runnable with `pnpm --filter @nest-boot/example-server command greet Alice --loud` after configuring its services and applying database migrations.

[Full documentation](https://github.com/nest-boot/nest-boot/blob/main/apps/docs/content/docs/tutorial/command.mdx)
