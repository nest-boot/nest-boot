/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import {
  DEFAULT_FIELD_COMPLEXITY,
  type FieldComplexityEstimatorArgs,
  GraphQLSchemaHost,
  GraphQLTooManyRequestsError,
} from "@nest-boot/graphql";
import { Plugin } from "@nestjs/apollo";
import { Inject } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import {
  getNamedType,
  isCompositeType,
  isNonNullType,
  isObjectType,
} from "graphql/index.js";
import type {
  ComplexityEstimator,
  ComplexityEstimatorArgs,
} from "graphql-query-complexity";
import * as graphqlQueryComplexity from "graphql-query-complexity/cjs";

import { OPTIONS_TOKEN } from "./graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage.js";
import type {
  CostResponse,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";

// graphql-query-complexity has a native ESM build, but it loads
// graphql/index.mjs while Nest's CommonJS packages load graphql/index.js.
// Keep the complexity library on its CJS export so both sides share the same
// GraphQL runtime types; otherwise real requests fail the cross-realm checks.
const {
  directiveEstimator,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} =
  graphqlQueryComplexity as unknown as typeof import("graphql-query-complexity");

/**
 * Adds one point to the child cost of an object, interface, or union field.
 * @param args - Field metadata and its calculated child cost.
 * @returns The composite field cost, if applicable.
 */
function compositeFieldEstimator(
  args: ComplexityEstimatorArgs,
): number | undefined {
  if (isCompositeType(getNamedType(args.field.type))) {
    return 1 + args.childComplexity;
  }
}

/**
 * Prices a field with the default defined on its object return type.
 * @param args - Field metadata, arguments, and calculated child cost.
 * @returns The return type's field cost, if configured.
 */
function returnTypeEstimator(
  args: ComplexityEstimatorArgs,
): number | undefined {
  const returnType = args.field.type;
  const type = isNonNullType(returnType) ? returnType.ofType : returnType;
  if (!isObjectType(type)) {
    return;
  }

  const complexity = type.extensions[DEFAULT_FIELD_COMPLEXITY];
  if (typeof complexity === "number") {
    return complexity + args.childComplexity;
  }
  if (typeof complexity === "function") {
    return (complexity as ComplexityEstimator)(args) ?? undefined;
  }
}

/**
 * Returns the first cost assigned by the configured estimators.
 * @param estimators - Estimators ordered by priority.
 * @param field - The field and its calculated child cost.
 * @returns The selected field cost, if an estimator supplied one.
 */
function estimateFieldCost(
  estimators: ComplexityEstimator[],
  field: ComplexityEstimatorArgs & FieldComplexityEstimatorArgs,
): number | undefined {
  for (const estimator of estimators) {
    const cost = estimator(field);
    if (typeof cost === "number" && !Number.isNaN(cost)) {
      return cost;
    }
  }
}

@Plugin()
export class GraphQLRateLimitPlugin implements ApolloServerPlugin {
  private readonly defaultEstimator: ComplexityEstimator;

  constructor(
    private readonly storage: GraphQLRateLimitStorage,
    private readonly moduleRef: ModuleRef,
    @Inject(OPTIONS_TOKEN) private readonly options: GraphQLRateLimitOptions,
  ) {
    this.defaultEstimator = simpleEstimator({
      defaultComplexity: options.defaultComplexity,
    });
  }

  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const { schema } = this.moduleRef.get(GraphQLSchemaHost, { strict: false });
    const { maxComplexity, defaultMutationComplexity } = this.options;
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();
    const estimateDirective = directiveEstimator();
    const fieldEstimators: ComplexityEstimator[] = [
      fieldExtensionsEstimator(),
      (args) =>
        args.type === mutationType || args.type === subscriptionType
          ? undefined
          : returnTypeEstimator(args),
      ({ type, childComplexity }) =>
        type === mutationType && defaultMutationComplexity !== undefined
          ? defaultMutationComplexity + childComplexity
          : undefined,
      compositeFieldEstimator,
      this.defaultEstimator,
    ];

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
          estimators: [estimateDirective, ...fieldEstimators],
        });

        if (cost.requestedQueryCost >= maxComplexity) {
          throw new GraphQLTooManyRequestsError(
            `Query is too complex: ${String(cost.requestedQueryCost)}. Maximum allowed complexity: ${String(maxComplexity)}`,
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
          throw new GraphQLTooManyRequestsError();
        }
      },
      executionDidStart: async () => {
        return {
          willResolveField: ({ args, info }) => {
            const parentTypeFields = info.parentType.getFields();
            const field = parentTypeFields[info.fieldName];

            const estimatorArgs: ComplexityEstimatorArgs = {
              childComplexity: 0,
              args,
              field,
              node: info.fieldNodes[0],
              type: info.parentType,
            };

            return (error, result: unknown) => {
              if (error === null) {
                // Directive multipliers reserve capacity for the requested selection.
                // Field callbacks can use the resolved arguments and value to settle their own work.
                cost.actualQueryCost +=
                  estimateDirective({ ...estimatorArgs, args: {} }) ??
                  estimateFieldCost(fieldEstimators, {
                    ...estimatorArgs,
                    resolved: { result },
                  }) ??
                  0;
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
