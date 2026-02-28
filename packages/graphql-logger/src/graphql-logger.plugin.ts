/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Logger } from "@nest-boot/logger";
import { Plugin } from "@nestjs/apollo";

/**
 * Apollo Server plugin that logs GraphQL operation metadata.
 *
 * @remarks
 * Adds operation ID, name, and type (query/mutation/subscription)
 * to the structured logger on each resolved operation.
 */
@Plugin()
export class GraphQLLoggerPlugin implements ApolloServerPlugin {
  /** Creates a new GraphQLLoggerPlugin instance.
   * @param logger - Structured logger for recording operation metadata
   */
  constructor(private readonly logger: Logger) {}

  /**
   * Hook invoked when a GraphQL request starts processing.
   * @returns A request listener that logs operation metadata after resolution
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
