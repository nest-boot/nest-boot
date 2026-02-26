/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Logger } from "@nest-boot/logger";
import { Plugin } from "@nestjs/apollo";

/**
 * Apollo Server plugin that logs GraphQL operation details.
 * It uses the @nest-boot/logger to log the operation ID, name, and type.
 */
@Plugin()
export class GraphQLLoggerPlugin implements ApolloServerPlugin {
  constructor(private readonly logger: Logger) {}

  /**
   * Called when a request starts. Returns a listener for request lifecycle events.
   */
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
