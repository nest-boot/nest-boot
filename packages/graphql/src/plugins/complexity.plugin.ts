import {
  type ApolloServerPlugin,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { HttpException, Inject, Logger } from "@nestjs/common";
import { GraphQLSchemaHost } from "@nestjs/graphql";
import {
  directiveEstimator,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from "graphql-query-complexity";

import { MODULE_OPTIONS_TOKEN } from "../graphql.module-definition";
import { GraphQLModuleOptions } from "../interfaces";

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(ComplexityPlugin.name);

  private readonly maxComplexity: number;
  private readonly defaultComplexity: number;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: GraphQLModuleOptions,
    private readonly gqlSchemaHost: GraphQLSchemaHost
  ) {
    this.maxComplexity = options.maxComplexity ?? 1000;
    this.defaultComplexity = options.defaultComplexity ?? 1;
  }

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.gqlSchemaHost;

    return {
      didResolveOperation: async ({ request, document }) => {
        const complexity: number = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            directiveEstimator({ name: "complexity" }),
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: this.defaultComplexity }),
          ],
        });

        if (complexity >= this.maxComplexity) {
          this.logger.error("query complexity", {
            operationName: request.operationName,
            complexity,
          });

          throw new HttpException(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${this.maxComplexity}`,
            429
          );
        }

        this.logger.log("query complexity", {
          operationName: request.operationName,
          complexity,
        });
      },
    };
  }
}
