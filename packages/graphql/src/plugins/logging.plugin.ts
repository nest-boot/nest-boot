/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Logger } from "@nest-boot/logger";
import { Plugin } from "@nestjs/apollo";
import { Optional } from "@nestjs/common";

function durationHrTimeToNanos(hrtime: [number, number]) {
  return hrtime[0] * 1e9 + hrtime[1];
}

@Plugin()
export class LoggingPlugin implements ApolloServerPlugin {
  constructor(
    @Optional()
    private readonly logger?: Logger,
  ) {}

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const logger = this.logger;

    if (typeof logger !== "undefined") {
      const startHrTime = process.hrtime();

      return {
        didResolveOperation: async (ctx) => {
          logger.assign({
            operation: {
              id: ctx.queryHash,
              name: ctx.operationName,
              type: ctx.operation?.operation?.toUpperCase(),
            },
          });
        },
        willSendResponse: async ({ response, errors }) => {
          const durationNs = durationHrTimeToNanos(process.hrtime(startHrTime));

          if (response.body.kind === "incremental") {
            return;
          }

          if (typeof errors !== "undefined" && errors.length > 0) {
            logger.error("graphql request errored", {
              durationNs,
            });
          } else {
            logger.log("graphql request completed", {
              durationNs,
            });
          }
        },
      };
    }

    return {};
  }
}
