import { DynamicModule, Logger, Type } from "@nestjs/common";
import { clc } from "@nestjs/common/utils/cli-colors.util";
import { NestFactory } from "@nestjs/core";
import { assignToObject } from "@nestjs/core/repl/assign-to-object.util";
import { REPL_INITIALIZED_MESSAGE } from "@nestjs/core/repl/constants";
import { ReplContext } from "@nestjs/core/repl/repl-context";
import { ReplLogger } from "@nestjs/core/repl/repl-logger";
import { defineDefaultCommandsOnRepl } from "@nestjs/core/repl/repl-native-commands";

import { RequestContext } from "./request-context";

export async function repl(module: Type | DynamicModule) {
  const app = await NestFactory.createApplicationContext(module, {
    abortOnError: false,
    logger: new ReplLogger(),
  });
  await app.init();

  return await RequestContext.run(new RequestContext(), async () => {
    const replContext = new ReplContext(app);
    Logger.log(REPL_INITIALIZED_MESSAGE);

    const replServer = (await import("repl")).start({
      prompt: clc.green("> "),
      ignoreUndefined: true,
    });

    replServer.context.RequestContext = RequestContext;

    assignToObject(replServer.context, replContext.globalScope);

    defineDefaultCommandsOnRepl(replServer);

    return replServer;
  });
}
