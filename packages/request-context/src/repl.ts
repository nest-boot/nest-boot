import { DynamicModule, Logger, Type } from "@nestjs/common";
import { clc } from "@nestjs/common/utils/cli-colors.util";
import { NestFactory } from "@nestjs/core";
import { assignToObject } from "@nestjs/core/repl/assign-to-object.util";
import { REPL_INITIALIZED_MESSAGE } from "@nestjs/core/repl/constants";
import { ReplContext } from "@nestjs/core/repl/repl-context";
import { ReplLogger } from "@nestjs/core/repl/repl-logger";
import { defineDefaultCommandsOnRepl } from "@nestjs/core/repl/repl-native-commands";
import { AsyncResource } from "async_hooks";
import { Transform } from "stream";

import { RequestContext } from "./request-context";

export async function repl(module: Type | DynamicModule) {
  const app = await NestFactory.createApplicationContext(module, {
    abortOnError: false,
    logger: new ReplLogger(),
  });

  await app.init();

  const replContext = new ReplContext(app);
  Logger.log(REPL_INITIALIZED_MESSAGE);

  return await RequestContext.run(new RequestContext(), async () => {
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
  });
}
