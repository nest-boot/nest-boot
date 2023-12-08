/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  GraphQLRequestContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import { Plugin } from "@nestjs/apollo";
import { HttpException, Inject, OnApplicationShutdown } from "@nestjs/common";
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
import { Redis } from "ioredis";

import { MODULE_OPTIONS_TOKEN } from "../graphql.module-definition";
import { CostResponse, GraphQLModuleOptions } from "../interfaces";

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

const REDIS_GRAPHQL_COMPLEXITY_RATE_LIMIT_COMMAND_NAME =
  "GRAPHQL_COMPLEXITY.RATE_LIMIT";

@Plugin()
export class ComplexityPlugin
  implements ApolloServerPlugin, OnApplicationShutdown
{
  private readonly complexityEstimators: ComplexityEstimator[] = [];

  private readonly maxComplexity: number = 1000;
  private readonly defaultComplexity: number = 0;

  private readonly rateLimitRedis?: Redis;
  private readonly rateLimitKeyPrefix: string = "graphql-complexity:rate-limit";
  private readonly rateLimitRestoreRate: number = 50;
  private readonly rateLimitMaximumAvailable: number = 1000;

  private readonly rateLimitGetId = (
    args: GraphQLRequestContext<BaseContext>,
  ) => {
    const req = (args.contextValue as { req: Request }).req;
    return req.ips.length ? req.ips[0] : req.ip;
  };

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: GraphQLModuleOptions,
    private readonly gqlSchemaHost: GraphQLSchemaHost,
  ) {
    if (typeof options.complexity !== "undefined") {
      this.maxComplexity =
        options.complexity.maxComplexity ?? this.maxComplexity;
      this.defaultComplexity =
        options.complexity.defaultComplexity ?? this.defaultComplexity;

      if (typeof options.complexity.rateLimit !== "undefined") {
        this.rateLimitRedis =
          typeof options.complexity.rateLimit.connection !== "undefined"
            ? new Redis(options.complexity.rateLimit.connection)
            : new Redis();

        this.rateLimitKeyPrefix =
          options.complexity.rateLimit.keyPrefix ?? this.rateLimitKeyPrefix;
        this.rateLimitRestoreRate =
          options.complexity.rateLimit.restoreRate ?? this.rateLimitRestoreRate;
        this.rateLimitMaximumAvailable =
          options.complexity.rateLimit.maximumAvailable ??
          this.rateLimitMaximumAvailable;
        this.rateLimitGetId =
          options.complexity.rateLimit.getId ?? this.rateLimitGetId;
      }
    }

    if (typeof this.rateLimitRedis !== "undefined") {
      this.rateLimitRedis.defineCommand(
        REDIS_GRAPHQL_COMPLEXITY_RATE_LIMIT_COMMAND_NAME,
        {
          numberOfKeys: 5,
          lua: /* lua */ `
          -- 获取当前时间戳
          local currentTimestamp = redis.call("TIME")[1]
          
          -- 获取参数
          local bucketKeyPrefix = KEYS[1]
          local maximumAvailable = tonumber(KEYS[2])
          local restoreRate = tonumber(KEYS[3])
          local id = KEYS[4]
          local complexity = tonumber(KEYS[5])
          
          -- 定义存储桶的键
          local bucketKey = bucketKeyPrefix .. ":" .. id
          
          local keyExpireSeconds = math.ceil(maximumAvailable / restoreRate)
          
          -- 获取存储桶中当前的令牌数量，如果不存在，则设置为最大可用令牌数
          local currentlyAvailable = redis.call("HGET", bucketKey, "currentlyAvailable")
          if not currentlyAvailable then
            currentlyAvailable = maximumAvailable
          end
          
          -- 如果存储桶为空，设置上次更新时间戳为当前时间戳
          local updatedTimestamp = redis.call("HGET", bucketKey, "updatedTimestamp")
          if not updatedTimestamp then
            updatedTimestamp = currentTimestamp
          end
          
          -- 更新上次更新的时间戳
          redis.call("HSET", bucketKey, "updatedTimestamp", currentTimestamp)
          
          -- 更新存储桶的过期时间
          redis.call("EXPIRE", bucketKey, keyExpireSeconds)
          
          -- 计算自上次更新以来要恢复的令牌数量，并恢复存储桶中的令牌数量
          local intervalSeconds = currentTimestamp - updatedTimestamp;
          if intervalSeconds > 0 then
            currentlyAvailable = math.min((restoreRate * intervalSeconds) + currentlyAvailable, maximumAvailable);
            redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
          end
          
          -- 检查是否有足够的令牌供扣减，如果有，则扣减并返回剩余令牌数
          local newCurrentlyAvailable = currentlyAvailable - complexity
          if newCurrentlyAvailable >= 0 then
            currentlyAvailable = newCurrentlyAvailable
            redis.call("HSET", bucketKey, "currentlyAvailable", currentlyAvailable)
            return { false, currentlyAvailable };
          end
          
          return { true, currentlyAvailable }
        `,
        },
      );
    }

    this.complexityEstimators = [
      directiveEstimator(),
      fieldExtensionsEstimator(),
      shopifyEstimator,
      simpleEstimator({ defaultComplexity: this.defaultComplexity }),
    ];
  }

  async addPoint(
    args: GraphQLRequestContext<BaseContext>,
    point: number,
  ): Promise<[boolean, number]> {
    if (typeof this.rateLimitRedis === "undefined") {
      throw new Error("Redis is not defined");
    }

    return (await (this.rateLimitRedis as any)[
      REDIS_GRAPHQL_COMPLEXITY_RATE_LIMIT_COMMAND_NAME
    ](
      this.rateLimitKeyPrefix,
      this.rateLimitMaximumAvailable,
      this.rateLimitRestoreRate,
      this.rateLimitGetId(args),
      -point,
    )) as [boolean, number];
  }

  async subPoint(
    args: GraphQLRequestContext<BaseContext>,
    point: number,
  ): Promise<[boolean, number]> {
    if (typeof this.rateLimitRedis === "undefined") {
      throw new Error("Redis is not defined");
    }

    return (await (this.rateLimitRedis as any)[
      REDIS_GRAPHQL_COMPLEXITY_RATE_LIMIT_COMMAND_NAME
    ](
      this.rateLimitKeyPrefix,
      this.rateLimitMaximumAvailable,
      this.rateLimitRestoreRate,
      this.rateLimitGetId(args),
      point,
    )) as [boolean, number];
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
            `Query is too complex: ${cost.requestedQueryCost}. Maximum allowed complexity: ${this.maxComplexity}`,
            429,
          );
        }

        if (typeof this.rateLimitRedis !== "undefined") {
          const [blocked, currentlyAvailable] = await this.subPoint(
            args,
            cost.requestedQueryCost,
          );

          cost.throttleStatus = {
            maximumAvailable: this.rateLimitMaximumAvailable,
            currentlyAvailable,
            restoreRate: this.rateLimitRestoreRate,
          };

          if (blocked) {
            throw new HttpException(`Too Many Requests`, 429);
          }
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
          if (typeof this.rateLimitRedis !== "undefined") {
            const [, currentlyAvailable] = await this.addPoint(
              request,
              cost.requestedQueryCost - cost.actualQueryCost,
            );

            cost.throttleStatus = {
              maximumAvailable: this.rateLimitMaximumAvailable,
              currentlyAvailable,
              restoreRate: this.rateLimitRestoreRate,
            };
          }

          request.response.body.singleResult.extensions = {
            ...request.response.body.singleResult.extensions,
            cost,
          };
        }
      },
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.rateLimitRedis?.quit();
  }
}
