import "reflect-metadata";

import { Injectable, Module, type ModuleMetadata, Scope } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Cli } from "clipanion";

import { BaseCommand } from "./base.command.js";
import { CommandModule } from "./command.module.js";
import { CommandRegistry } from "./command.registry.js";
import { Command } from "./decorators/command.decorator.js";

/**
 * Validates providers using the actual Nest discovery service.
 * @param providers - Application command providers.
 */
async function register(providers: ModuleMetadata["providers"]): Promise<void> {
  @Module({ imports: [CommandModule], providers })
  class AppModule {}
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    app.get(CommandRegistry).register(new Cli());
  } finally {
    await app.close();
  }
}

it("rejects a decorated provider that does not extend BaseCommand", async () => {
  @Command({ paths: [["invalid"]] })
  class InvalidCommand {}
  await expect(register([InvalidCommand])).rejects.toThrow(
    "must extend BaseCommand",
  );
});

it.each([
  { paths: [], message: "must declare at least one path" },
  { paths: [[]], message: "has an invalid path" },
  { paths: [[""]], message: "has an invalid path" },
  { paths: [["bad path"]], message: "has an invalid path" },
  { paths: [["valid", ""]], message: "has an invalid path" },
])("rejects invalid command paths $paths", async ({ paths, message }) => {
  @Command({ paths })
  class InvalidCommand extends BaseCommand {
    async execute() {
      await Promise.reject(new Error("Invalid commands must not execute."));
    }
  }
  await expect(register([InvalidCommand])).rejects.toThrow(message);
});

it("rejects transient commands", async () => {
  @Injectable({ scope: Scope.TRANSIENT })
  @Command({ paths: [["transient"]] })
  class TransientCommand extends BaseCommand {
    async execute() {
      await Promise.reject(new Error("Transient commands must not execute."));
    }
  }
  await expect(register([TransientCommand])).rejects.toThrow(
    "singleton dependencies",
  );
});
