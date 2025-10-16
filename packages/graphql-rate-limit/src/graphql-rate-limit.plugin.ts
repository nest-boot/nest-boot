/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  GraphQLRequestContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { HttpException } from "@nestjs/common";
import { GraphQLSchemaHost } from "@nestjs/graphql";
import { Request } from "express";
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
  ComplexityEstimator,
  ComplexityEstimatorArgs,
  directiveEstimator,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from "graphql-query-complexity";

import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage";
import { CostResponse } from "./interfaces";

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
  if (type instanceof GraphQLObjectType && type.name.endsWith("Connection")) {
    return 2 + args.childComplexity * (args.args.first ?? args.args.last ?? 0);
  }

  // Object 是查询的基本单位，一般代码一个单次的 server 端操作，可以是一次数据库查询，也可以一次内部服务的访问。
  // Interface 和 Union 和 Object 类似，只不过是能返回不同类型的 object，所以算一点。
  if (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType ||
    type instanceof GraphQLUnionType
  ) {
    return 1 + args.childComplexity;
  }

  // Scalar 和 Enum 是 Object 本身的一部分，在 Object 里我们已经算过消耗了。
  // Scalar 和 Enum 其实就是 Object 上的某个字段，一个 Object 上多返回几个字段消耗是比较少的。
  if (type instanceof GraphQLScalarType || type instanceof GraphQLEnumType) {
    return 0;
  }
}

@Plugin()
export class GraphQLRateLimitPlugin implements ApolloServerPlugin {
  private readonly complexityEstimators: ComplexityEstimator[] = [];

  private readonly maxComplexity: number = 1000;
  private readonly defaultComplexity: number = 0;

  private readonly rateLimitGetId = (
    args: GraphQLRequestContext<BaseContext>,
  ) => {
    const req = (args.contextValue as { req: Request }).req;
    return req.ips.length ? req.ips[0] : req.ip;
  };

  constructor(
    private readonly storage: GraphQLRateLimitStorage,
    private readonly gqlSchemaHost: GraphQLSchemaHost,
  ) {
    this.complexityEstimators = [
      directiveEstimator(),
      fieldExtensionsEstimator(),
      shopifyEstimator,
      simpleEstimator({ defaultComplexity: this.defaultComplexity }),
    ];
  }

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const { schema } = this.gqlSchemaHost;

    const cost: CostResponse = {
      requestedQueryCost: 0,
      actualQueryCost: 0,
    };

    return {
      didResolveOperation: async (args) => {
        const { request, document } = args;

        cost.requestedQueryCost = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: this.complexityEstimators,
        });

        if (cost.requestedQueryCost >= this.maxComplexity) {
          throw new HttpException(
            `Query is too complex: ${String(cost.requestedQueryCost)}. Maximum allowed complexity: ${String(this.maxComplexity)}`,
            429,
          );
        }

        const { blocked, currentlyAvailable, maximumAvailable, restoreRate } =
          await this.storage.subPoint(args, cost.requestedQueryCost);

        cost.throttleStatus = {
          blocked,
          maximumAvailable,
          currentlyAvailable,
          restoreRate,
        };

        if (blocked) {
          throw new HttpException(`Too Many Requests`, 429);
        }
      },
      executionDidStart: async () => {
        return {
          willResolveField: ({ info }) => {
            const parentTypeFields = info.parentType.getFields();
            const field = parentTypeFields[info.fieldName];

            const estimatorArgs: ComplexityEstimatorArgs = {
              childComplexity: 0,
              args: {},
              field,
              node: info.fieldNodes[0],
              type: info.parentType,
            };

            return (error) => {
              if (error === null) {
                // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
                let fieldCost: number | void;

                for (const complexityEstimator of this.complexityEstimators) {
                  fieldCost = complexityEstimator(estimatorArgs);

                  if (typeof fieldCost === "number" && !isNaN(fieldCost)) {
                    cost.actualQueryCost += fieldCost;
                    break;
                  }
                }
              }
            };
          },
        };
      },
      willSendResponse: async (request): Promise<void> => {
        if (
          request.response.body.kind === "single" &&
          "data" in request.response.body.singleResult
        ) {
          const { blocked, currentlyAvailable, maximumAvailable, restoreRate } =
            await this.storage.addPoint(
              request,
              cost.requestedQueryCost - cost.actualQueryCost,
            );

          cost.throttleStatus = {
            blocked,
            maximumAvailable,
            currentlyAvailable,
            restoreRate,
          };

          request.response.body.singleResult.extensions = {
            ...request.response.body.singleResult.extensions,
            cost,
          };
        }
      },
    };
  }
}
