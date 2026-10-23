import { RequestContext } from "@nest-boot/request-context";
import type { DynamicModule, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { InvalidClassScopeException } from "@nestjs/core/errors/exceptions/invalid-class-scope.exception";
import { UnknownElementException } from "@nestjs/core/errors/exceptions/unknown-element.exception";
import { type BaseContext, Builtins, Cli, type CliOptions } from "clipanion";

import { CommandRegistry } from "./command.registry.js";

/** Programmatic command execution settings. */
export interface CommandFactoryOptions extends Partial<CliOptions> {
  /** Command arguments without the Node executable and script name. */
  args?: string[];
  /** Nest application settings; logger defaults to false. */
  contextOptions?: NonNullable<
    Parameters<typeof NestFactory.createApplicationContext>[1]
  >;
  /** Optional streams and environment overrides for command execution. */
  context?: Partial<BaseContext>;
}

/** Boots a standalone Nest context, runs one command, then closes its resources. */
export class CommandFactory {
  /**
   * Executes commands declared in the root module and its imported modules.
   * Called once by the CLI bootstrap in each process.
   * @param rootModule - CLI root module importing CommandModule.
   * @param options - Arguments, help configuration and Nest settings.
   * @returns The command exit code, also assigned to process.exitCode.
   */
  static async run(
    rootModule: Type | DynamicModule,
    options: CommandFactoryOptions = {},
  ): Promise<number> {
    try {
      const app = await NestFactory.createApplicationContext(rootModule, {
        logger: false,
        ...options.contextOptions,
        abortOnError: false,
      });
      let exitCode: number;
      try {
        const cli = new Cli({ binaryName: "nb", ...options });
        cli.register(Builtins.HelpCommand);
        if (options.binaryVersion) {
          cli.register(Builtins.VersionCommand);
        }
        app.get(CommandRegistry, { strict: false }).register(cli);
        const args = options.args ?? process.argv.slice(2);
        exitCode = await RequestContext.run(
          new RequestContext({
            type: "command",
            dependencyResolver: (token) => {
              try {
                return app.get(token, { strict: false });
              } catch (error) {
                // Like HTTP contexts, command contexts only resolve singletons.
                if (
                  error instanceof UnknownElementException ||
                  error instanceof InvalidClassScopeException
                ) {
                  return undefined;
                }
                throw error;
              }
            },
          }),
          () => cli.run(args.length ? args : ["--help"], options.context ?? {}),
        );
      } finally {
        await app.close();
      }
      process.exitCode = exitCode;
      return exitCode;
    } catch (error) {
      process.exitCode = 1;
      throw error;
    }
  }
}
