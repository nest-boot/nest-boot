/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { HttpException, Inject, Logger } from "@nestjs/common";
import { GraphQLSchemaHost } from "@nestjs/graphql";
import {
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLType,
  GraphQLUnionType,
} from "graphql";
import {
  ComplexityEstimatorArgs,
  directiveEstimator,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from "graphql-query-complexity";

import { MODULE_OPTIONS_TOKEN } from "../graphql.module-definition";
import { GraphQLModuleOptions } from "../interfaces";

// https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity
function shopifyEstimator(
  args: ComplexityEstimatorArgs,
  type?: GraphQLType,
): number | undefined {
  type = type ?? args.field.type;

  if (type instanceof GraphQLNonNull || type instanceof GraphQLList) {
    return shopifyEstimator(args, type.ofType);
  }

  // GraphQL 的 Connection 表示的是一对多的关系，Connection 的消耗是两点加上要返回的对象数量。
  if (
    type instanceof GraphQLObjectType &&
    type.name.endsWith("Connection") &&
    typeof (args.args.first ?? args.args.last) === "number"
  ) {
    return 2 + args.childComplexity * (args.args.first ?? args.args.last);
  }

  // Object 是查询的基本单位，一般代码一个单次的 server 端操作，可以是一次数据库查询，也可以一次内部服务的访问。
  // Interface 和 Union 和 Object 类似，只不过是能返回不同类型的 object，所以算一点。
  if (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  ) {
    return 1;
  }

  // Scalar 和 Enum 是 Object 本身的一部分，在 Object 里我们已经算过消耗了。
  // Scalar 和 Enum 其实就是 Object 上的某个字段，一个 Object 上多返回几个字段消耗是比较少的。
  if (type instanceof GraphQLScalarType || type instanceof GraphQLEnumType) {
    return 0;
  }
}

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(ComplexityPlugin.name);

  private readonly logging: boolean;
  private readonly maxComplexity: number;
  private readonly defaultComplexity: number;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: GraphQLModuleOptions,
    private readonly gqlSchemaHost: GraphQLSchemaHost,
  ) {
    this.logging = options.complexity?.logging ?? false;
    this.maxComplexity = options.complexity?.maxComplexity ?? 1000;
    this.defaultComplexity = options.complexity?.defaultComplexity ?? 0;
  }

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const { schema } = this.gqlSchemaHost;

    return {
      didResolveOperation: async ({ request, document }) => {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            directiveEstimator({ name: "complexity" }),
            fieldExtensionsEstimator(),
            shopifyEstimator,
            simpleEstimator({ defaultComplexity: this.defaultComplexity }),
          ],
        });

        request.extensions = request.extensions ?? {};
        request.extensions.cost = {
          requestedQueryCost: complexity,
        };

        if (this.logging) {
          this.logger.log("query complexity", {
            operationName: request.operationName,
            complexity,
          });
        }

        if (complexity >= this.maxComplexity) {
          throw new HttpException(
            `Query is too complex: ${complexity}. Maximum allowed complexity: ${this.maxComplexity}`,
            429,
          );
        }
      },
      willSendResponse: async ({ request, response }): Promise<void> => {
        if (
          response.body.kind === "single" &&
          "data" in response.body.singleResult &&
          typeof request.extensions?.cost !== "undefined"
        ) {
          response.body.singleResult.extensions = {
            ...response.body.singleResult.extensions,
            ...request.extensions.cost,
          };
        }
      },
    };
  }
}
