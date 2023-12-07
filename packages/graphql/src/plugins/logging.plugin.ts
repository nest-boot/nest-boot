/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Logger } from "@nest-boot/logger";
import { Plugin } from "@nestjs/apollo";
import { Optional } from "@nestjs/common";

@Plugin()
export class LoggingPlugin implements ApolloServerPlugin {
  constructor(
    @Optional()
    private readonly logger?: Logger,
  ) {}

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const logger = this.logger;

    if (typeof logger !== "undefined") {
      return {
        didResolveOperation: async (ctx) => {
          logger.assign({
            operation: {
              id: ctx.queryHash,
              name: ctx.operationName,
              type: ctx.operation?.operation,
            },
          });
        },
      };
    }

    return {};
  }
}
