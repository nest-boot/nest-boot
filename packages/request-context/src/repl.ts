import { DynamicModule, Logger, Type } from "@nestjs/common";
import { clc } from "@nestjs/common/utils/cli-colors.util";
import { NestFactory } from "@nestjs/core";
import { assignToObject } from "@nestjs/core/repl/assign-to-object.util";
import { REPL_INITIALIZED_MESSAGE } from "@nestjs/core/repl/constants";
import { ReplContext } from "@nestjs/core/repl/repl-context";
import { ReplLogger } from "@nestjs/core/repl/repl-logger";
import { defineDefaultCommandsOnRepl } from "@nestjs/core/repl/repl-native-commands";
import { AsyncResource } from "async_hooks";
import type { REPLServer } from "repl";
import { Transform } from "stream";

import { RequestContext } from "./request-context";

/**
 * Starts a REPL (Read-Eval-Print Loop) session with request context support.
 *
 * This function creates a NestJS application context and starts an interactive
 * REPL session where all commands run within a request context. This is useful
 * for debugging and testing services that depend on request context.
 *
 * The REPL session:
 * - Runs within a request context of type 'repl'
 * - Has access to all NestJS providers
 * - Maintains context across async operations
 *
 * @param module - The NestJS module (class or DynamicModule) to create the context from
 * @returns A promise that resolves to the REPL server instance
 *
 * @example
 * ```typescript
 * // repl.ts
 * import { repl } from '@nest-boot/request-context';
 * import { AppModule } from './app.module';
 *
 * async function bootstrap() {
 *   await repl(AppModule);
 * }
 *
 * bootstrap();
 * ```
 *
 * @example Running the REPL
 * ```bash
 * npx ts-node -r tsconfig-paths/register repl.ts
 * ```
 *
 * @example Using services in REPL
 * ```typescript
 * // In the REPL session:
 * > const userService = get(UserService)
 * > await userService.findAll()
 * > RequestContext.id  // Access current context ID
 * ```
 */
export async function repl(module: Type | DynamicModule): Promise<REPLServer> {
  const app = await NestFactory.createApplicationContext(module, {
    abortOnError: false,
    logger: new ReplLogger(),
  });

  await app.init();

  const replContext = new ReplContext(app);
  Logger.log(REPL_INITIALIZED_MESSAGE);

  return await RequestContext.run(
    new RequestContext({ type: "repl" }),
    async () => {
      const asyncResource = new AsyncResource("REPL");

      const replServer = (await import("repl")).start({
        input: new Proxy(
          process.stdin.pipe(
            new Transform({
              transform(chunk, encoding, callback) {
                asyncResource.runInAsyncScope(callback, null, null, chunk);
              },
            }),
          ),
          {
            get(target, prop, receiver) {
              if (prop in target) {
                return Reflect.get(target, prop, receiver);
              } else if (prop in process.stdin) {
                return Reflect.get(process.stdin, prop, receiver);
              }
            },
          },
        ),
        output: process.stdout,
        prompt: clc.green("> "),
        ignoreUndefined: true,
      });

      assignToObject(replServer.context, replContext.globalScope);

      defineDefaultCommandsOnRepl(replServer);

      return replServer;
    },
  );
}
