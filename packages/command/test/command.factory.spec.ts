import "reflect-metadata";

import { Writable } from "node:stream";

import { RequestContext } from "@nest-boot/request-context";
import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  Scope,
} from "@nestjs/common";
import { REQUEST as NEST_REQUEST } from "@nestjs/core";

import {
  BaseCommand,
  Command,
  CommandFactory,
  CommandModule,
  Option,
} from "../src/index.js";

const events: string[] = [];
const calls: {
  name: string;
  loud: boolean;
  identity: boolean;
  tokens: BaseCommand["tokens"];
}[] = [];

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
      tokens: this.tokens,
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
  expect(calls).toEqual([
    {
      name: "Alice",
      loud: true,
      identity: true,
      tokens: [
        { segmentIndex: 0, type: "path" },
        { segmentIndex: 1, type: "path" },
        { segmentIndex: 2, type: "positional" },
        { segmentIndex: 3, type: "option", option: "--loud" },
      ],
    },
  ]);
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
    name = Option.String({ required: true });
    async execute() {
      this.name = "updated during execution";
      executing = RequestContext.current();
      await Promise.reject(new Error("expected failure"));
    }
    async catch() {
      await Promise.resolve();
      expect(RequestContext.current()).toBe(executing);
      expect(this.name).toBe("updated during execution");
    }
  }
  @Module({ imports: [CommandModule], providers: [FailingCommand] })
  class AppModule {}
  await CommandFactory.run(AppModule, {
    args: ["fail-with-context", "original"],
    context: capture(),
  });
  expect(executing?.type).toBe("command");
  expect(RequestContext.isActive()).toBe(false);
});

it("resolves singleton providers in command middleware and execution while leaving unavailable tokens undefined", async () => {
  @Injectable({ scope: Scope.REQUEST })
  class RequestService {}
  @Injectable({ scope: Scope.TRANSIENT })
  class TransientService {}
  const serviceAlias = Symbol("greeting-service");
  const lookups: (GreetingService | undefined)[] = [];
  RequestContext.registerMiddleware(
    "command-provider-test",
    async (ctx, next) => {
      ctx.alias(serviceAlias, GreetingService);
      lookups.push(ctx.get<GreetingService>(serviceAlias));
      expect(ctx.get(NEST_REQUEST)).toBeUndefined();
      expect(ctx.get(RequestService)).toBeUndefined();
      expect(ctx.get(TransientService)).toBeUndefined();
      expect(ctx.get("unregistered-command-token")).toBeUndefined();
      ctx.set("command-local-value", "stored");
      return await next();
    },
  );
  @Command({ paths: [["providers"]] })
  class ProviderCommand extends BaseCommand {
    constructor(
      @Inject(GreetingService) private readonly service: GreetingService,
    ) {
      super();
    }
    async execute() {
      expect(RequestContext.get(GreetingService)).toBe(this.service);
      expect(RequestContext.get(serviceAlias)).toBe(this.service);
      expect(RequestContext.get("command-local-value")).toBe("stored");
      await Promise.resolve();
    }
  }
  @Module({
    providers: [
      GreetingService,
      RequestService,
      TransientService,
      ProviderCommand,
    ],
  })
  class ProviderModule {}
  @Module({ imports: [CommandModule, ProviderModule] })
  class AppModule {}
  try {
    expect(await CommandFactory.run(AppModule, { args: ["providers"] })).toBe(
      0,
    );
    expect(lookups).toHaveLength(1);
    expect(lookups[0]).toBeInstanceOf(GreetingService);
  } finally {
    RequestContext.registerMiddleware("command-provider-test", (_ctx, next) =>
      next(),
    );
  }
});

it("copies parsed options and CLI state to custom error handlers after schema validation fails", async () => {
  let executed = false;
  let handled = false;
  @Command({ paths: [["validate"]] })
  class ValidationCommand extends BaseCommand {
    static schema: NonNullable<typeof BaseCommand.schema> = [() => false];
    name = Option.String({ required: true });
    loud = Option.Boolean("--loud", false);
    async execute() {
      executed = true;
      await Promise.resolve();
    }
    async catch(error: Error) {
      handled = true;
      expect(error.message).toContain("Invalid option schema");
      expect(this.name).toBe("Alice");
      expect(this.loud).toBe(true);
      expect(this.path).toEqual(["validate"]);
      expect(this.help).toBe(false);
      expect(this.tokens).toEqual([
        { segmentIndex: 0, type: "path" },
        { segmentIndex: 1, type: "positional" },
        { segmentIndex: 2, type: "option", option: "--loud" },
      ]);
      expect(this.cli.binaryName).toBe("nb");
      expect(RequestContext.current().type).toBe("command");
      this.context.stdout.write(`Handled:${this.name}`);
      await Promise.resolve();
    }
  }
  @Module({ imports: [CommandModule], providers: [ValidationCommand] })
  class AppModule {}
  const output = capture();
  expect(
    await CommandFactory.run(AppModule, {
      args: ["validate", "Alice", "--loud"],
      context: output,
    }),
  ).toBe(0);
  expect(executed).toBe(false);
  expect(handled).toBe(true);
  expect(output.output()).toBe("Handled:Alice");
});

it("isolates application middleware registrations across sequential and concurrent runs", async () => {
  const labelToken = Symbol("application-label");
  const middlewareValue = Symbol("middleware-value");
  const middlewareName = "command-application-test";
  @Injectable()
  class ApplicationMiddleware {
    closed = false;
    constructor(@Inject(labelToken) private readonly label: string) {}
    onModuleInit() {
      RequestContext.registerMiddleware(middlewareName, async (ctx, next) => {
        expect(this.closed).toBe(false);
        ctx.set(middlewareValue, this.label);
        return await next();
      });
    }
    onApplicationShutdown() {
      this.closed = true;
    }
  }
  @Command({ paths: [["application"]] })
  class ApplicationCommand extends BaseCommand {
    constructor(
      @Inject(labelToken) private readonly label: string | undefined,
    ) {
      super();
    }
    async execute() {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(RequestContext.get(middlewareValue)).toBe(this.label);
    }
  }
  @Module({})
  class AppModule {}
  const application = (label?: string): DynamicModule => ({
    module: AppModule,
    imports: [CommandModule],
    providers: [
      { provide: labelToken, useValue: label },
      ApplicationCommand,
      ...(label ? [ApplicationMiddleware] : []),
    ],
  });
  const run = (label?: string) =>
    CommandFactory.run(application(label), {
      args: ["application"],
      context: capture(),
    });
  try {
    expect(await run("first")).toBe(0);
    expect(await run()).toBe(0);
    expect(
      await Promise.all([run("concurrent-a"), run("concurrent-b")]),
    ).toEqual([0, 0]);
    expect(await run()).toBe(0);
  } finally {
    RequestContext.registerMiddleware(middlewareName, (_ctx, next) => next());
  }
});

it.each([0, 20])(
  "preserves concurrent failure exit codes with a %d ms failure delay",
  async (failureDelay) => {
    @Command({ paths: [["status"]] })
    class StatusCommand extends BaseCommand {
      outcome = Option.String({ required: true });
      async execute() {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            this.outcome === "fail" ? failureDelay : 20 - failureDelay,
          ),
        );
        return this.outcome === "fail" ? 7 : 0;
      }
    }
    @Module({ imports: [CommandModule], providers: [StatusCommand] })
    class AppModule {}
    const run = (outcome: string) =>
      CommandFactory.run(AppModule, {
        args: ["status", outcome],
        context: capture(),
      });
    expect(await Promise.all([run("fail"), run("success")])).toEqual([7, 0]);
    expect(process.exitCode).toBe(7);
    expect(await run("success")).toBe(0);
    expect(process.exitCode).toBe(0);
  },
);

it("does not mask a concurrent factory error with a successful command", async () => {
  @Module({})
  class MissingCommandModule {}
  @Command({ paths: [["slow-success"]] })
  class SlowCommand extends BaseCommand {
    async execute() {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  @Module({ imports: [CommandModule], providers: [SlowCommand] })
  class AppModule {}
  const results = await Promise.allSettled([
    CommandFactory.run(MissingCommandModule, { args: [] }),
    CommandFactory.run(AppModule, {
      args: ["slow-success"],
      context: capture(),
    }),
  ]);
  expect(results[0].status).toBe("rejected");
  expect(results[1]).toEqual({ status: "fulfilled", value: 0 });
  expect(process.exitCode).toBe(1);
});
