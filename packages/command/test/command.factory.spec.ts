import "reflect-metadata";

import { Writable } from "node:stream";

import { Inject, Injectable, Module, Scope } from "@nestjs/common";

import {
  BaseCommand,
  Command,
  CommandFactory,
  CommandModule,
  Option,
} from "../src/index.js";

const events: string[] = [];
const calls: { name: string; loud: boolean; identity: boolean }[] = [];

@Injectable()
class GreetingService {
  format(name: string, loud: boolean) {
    return loud ? name.toUpperCase() : name;
  }
  onApplicationShutdown() {
    events.push("closed");
  }
}

@Command({
  paths: [["greet"], ["hello", "user"]],
  usage: { description: "Greet a user." },
})
class GreetingCommand extends BaseCommand {
  name = Option.String({ required: true });
  loud = Option.Boolean("--loud", false);
  #identity = this;
  constructor(
    @Inject(GreetingService) private readonly service: GreetingService,
  ) {
    super();
  }
  async execute() {
    calls.push({
      name: this.name,
      loud: this.loud,
      identity: this.#identity === this,
    });
    this.context.stdout.write(this.service.format(this.name, this.loud));
    await Promise.resolve();
  }
}

@Module({ providers: [GreetingService, GreetingCommand] })
class FeatureModule {}

@Module({ imports: [CommandModule, FeatureModule] })
class CliModule {}

/**
 *
 */
/** @returns Captured command output and test streams. */
function capture() {
  const chunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { stdout, stderr: stdout, output: () => chunks.join("") };
}

let previousExitCode: typeof process.exitCode;
beforeEach(() => {
  previousExitCode = process.exitCode;
  events.length = 0;
  calls.length = 0;
});

afterEach(() => {
  process.exitCode = previousExitCode;
});

it("discovers commands in another module and preserves the Nest instance and its injection", async () => {
  const output = capture();
  expect(
    await CommandFactory.run(CliModule, {
      args: ["hello", "user", "Alice", "--loud"],
      context: output,
    }),
  ).toBe(0);
  expect(output.output()).toBe("ALICE");
  expect(calls).toEqual([{ name: "Alice", loud: true, identity: true }]);
  expect(events).toEqual(["closed"]);
});

it("infers positional, optional, boolean and array types without manual interfaces", () => {
  class TypedCommand extends BaseCommand {
    name = Option.String({ required: true });
    schema = Option.String("--schema");
    enabled = Option.Boolean("--enabled", false);
    tags = Option.Array("--tag", []);
    async execute() {
      await Promise.resolve();
    }
  }
  const command = new TypedCommand();
  expectTypeOf(command.name).toEqualTypeOf<string>();
  expectTypeOf(command.schema).toEqualTypeOf<string | undefined>();
  expectTypeOf(command.enabled).toEqualTypeOf<boolean>();
  expectTypeOf(command.tags).toEqualTypeOf<string[]>();
});

it.each([[], ["--help"], ["greet", "--help"]].map((args) => [args]))(
  "shows help and closes the context for %j",
  async (args) => {
    const output = capture();
    expect(await CommandFactory.run(CliModule, { args, context: output })).toBe(
      0,
    );
    expect(process.exitCode).toBe(0);
    expect(output.output()).toContain("Greet a user");
    expect(calls).toEqual([]);
    expect(events).toEqual(["closed"]);
  },
);

it.each(
  [["unknown"], ["greet"], ["greet", "Alice", "--missing"]].map((args) => [
    args,
  ]),
)("returns failure and closes on invalid arguments %j", async (args) => {
  const output = capture();
  expect(await CommandFactory.run(CliModule, { args, context: output })).toBe(
    1,
  );
  expect(process.exitCode).toBe(1);
  expect(output.output()).toBeTruthy();
  expect(calls).toEqual([]);
  expect(events).toEqual(["closed"]);
});

it("supports a version without running a command", async () => {
  const output = capture();
  expect(
    await CommandFactory.run(CliModule, {
      args: ["--version"],
      binaryVersion: "1.2.3",
      context: output,
    }),
  ).toBe(0);
  expect(output.output()).toContain("1.2.3");
  expect(events).toEqual(["closed"]);
});

it("closes the application after an execution failure", async () => {
  @Command({ paths: [["fail"]] })
  class FailingCommand extends BaseCommand {
    async execute(): Promise<void> {
      await Promise.reject(new Error("failed command"));
    }
  }
  @Module({
    imports: [CommandModule],
    providers: [GreetingService, FailingCommand],
  })
  class FailureModule {}
  const output = capture();
  expect(
    await CommandFactory.run(FailureModule, {
      args: ["fail"],
      context: output,
    }),
  ).toBe(1);
  expect(process.exitCode).toBe(1);
  expect(output.output()).toContain("failed command");
  expect(events).toEqual(["closed"]);
});

it("rejects duplicate command paths", async () => {
  @Command({ paths: [["greet"]] })
  class DuplicateCommand extends BaseCommand {
    async execute() {
      await Promise.resolve();
    }
  }
  @Module({
    imports: [CommandModule, FeatureModule],
    providers: [DuplicateCommand],
  })
  class DuplicateModule {}
  await expect(
    CommandFactory.run(DuplicateModule, { args: [] }),
  ).rejects.toThrow("Duplicate command path");
  expect(process.exitCode).toBe(1);
  expect(events).toEqual(["closed"]);
});

it("rejects request-scoped commands", async () => {
  @Injectable({ scope: Scope.REQUEST })
  @Command({ paths: [["scoped"]] })
  class ScopedCommand extends BaseCommand {
    async execute() {
      await Promise.resolve();
    }
  }
  @Module({ imports: [CommandModule], providers: [ScopedCommand] })
  class ScopedModule {}
  await expect(CommandFactory.run(ScopedModule, { args: [] })).rejects.toThrow(
    "singleton dependencies",
  );
});

it("runs initialization, command execution and shutdown in order", async () => {
  const lifecycle: string[] = [];
  @Command({ paths: [["context"]] })
  class ContextCommand extends BaseCommand {
    onModuleInit() {
      lifecycle.push("init");
    }
    async execute() {
      await Promise.resolve();
      lifecycle.push("execute");
    }
    onApplicationShutdown() {
      lifecycle.push("shutdown");
    }
  }
  @Module({ imports: [CommandModule], providers: [ContextCommand] })
  class AppModule {}
  await CommandFactory.run(AppModule, { args: ["context"] });
  expect(lifecycle).toEqual(["init", "execute", "shutdown"]);
});

it("provides isolated command contexts to services and executes context middleware", async () => {
  const { RequestContext } = await import("@nest-boot/request-context");
  const contexts: InstanceType<typeof RequestContext>[] = [];
  const middlewareEvents: string[] = [];
  RequestContext.registerMiddleware("command-test", async (ctx, next) => {
    ctx.set("command-test-value", ctx.id);
    middlewareEvents.push(`before:${ctx.id}`);
    try {
      return await next();
    } finally {
      middlewareEvents.push(`after:${ctx.id}`);
    }
  });
  @Injectable()
  class ContextService {
    async read() {
      const context = RequestContext.current();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(RequestContext.current()).toBe(context);
      expect(RequestContext.get("command-test-value")).toBe(context.id);
      return context;
    }
  }
  @Command({ paths: [["context"]] })
  class ContextCommand extends BaseCommand {
    constructor(
      @Inject(ContextService) private readonly service: ContextService,
    ) {
      super();
    }
    async execute() {
      const context = await this.service.read();
      expect(context.type).toBe("command");
      contexts.push(context);
    }
  }
  @Module({
    imports: [CommandModule],
    providers: [ContextCommand, ContextService],
  })
  class AppModule {}
  try {
    await Promise.all([
      CommandFactory.run(AppModule, { args: ["context"] }),
      CommandFactory.run(AppModule, { args: ["context"] }),
    ]);
    expect(contexts).toHaveLength(2);
    expect(contexts[0].id).not.toBe(contexts[1].id);
    expect(RequestContext.isActive()).toBe(false);
    for (const context of contexts) {
      expect(middlewareEvents.indexOf(`before:${context.id}`)).toBeLessThan(
        middlewareEvents.indexOf(`after:${context.id}`),
      );
    }
  } finally {
    RequestContext.registerMiddleware("command-test", (_ctx, next) => next());
  }
});

it("keeps the command context available to custom error handling and clears it afterwards", async () => {
  const { RequestContext } = await import("@nest-boot/request-context");
  let executing: InstanceType<typeof RequestContext> | undefined;
  @Command({ paths: [["fail-with-context"]] })
  class FailingCommand extends BaseCommand {
    async execute() {
      executing = RequestContext.current();
      await Promise.reject(new Error("expected failure"));
    }
    async catch() {
      await Promise.resolve();
      expect(RequestContext.current()).toBe(executing);
    }
  }
  @Module({ imports: [CommandModule], providers: [FailingCommand] })
  class AppModule {}
  await CommandFactory.run(AppModule, {
    args: ["fail-with-context"],
    context: capture(),
  });
  expect(executing?.type).toBe("command");
  expect(RequestContext.isActive()).toBe(false);
});
