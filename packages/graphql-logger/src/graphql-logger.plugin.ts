/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Logger } from "@nest-boot/logger";
import { Plugin } from "@nestjs/apollo";

@Plugin()
export class GraphQLLoggerPlugin implements ApolloServerPlugin {
  constructor(private readonly logger: Logger) {}

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    return {
      didResolveOperation: async (ctx) => {
        this.logger.assign({
          operation: {
            id: ctx.queryHash,
            name: ctx.operationName,
            type: ctx.operation?.operation,
          },
        });
      },
    };
  }
}
