/* eslint-disable @typescript-eslint/require-await */

import {
  type ApolloServerPlugin,
  type BaseContext,
  type GraphQLRequestListener,
} from "@apollo/server";
import {
  type FieldComplexityEstimatorArgs,
  GraphQLSchemaHost,
  GraphQLTooManyRequestsError,
} from "@nest-boot/graphql";
import { Plugin } from "@nestjs/apollo";
import { Inject } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { collectFields } from "graphql/execution/collectFields.js";
import {
  type DocumentNode,
  type FieldNode,
  getNamedType,
  getVariableValues,
  type GraphQLField,
  type GraphQLSchema,
  isCompositeType,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
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

/**
 * Collects root mutation fields as execution does, one per response key.
 * @param schema - The request schema.
 * @param document - The validated request document.
 * @param operation - The selected mutation.
 * @param variables - The request variables.
 * @returns Root selections that can be identified separately from nested fields.
 */
function collectMutationSelections(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  variables: Record<string, unknown>,
): FieldNode[] {
  const mutationType = schema.getMutationType();
  if (!mutationType) {
    return [];
  }

  // Field collection evaluates @include and @skip. Let the complexity
  // estimator handle coercion of field arguments, including custom scalars.
  const directiveVariables = (operation.variableDefinitions ?? []).filter(
    ({ type }) => {
      const variableType = type.kind === Kind.NON_NULL_TYPE ? type.type : type;
      return (
        variableType.kind === Kind.NAMED_TYPE &&
        variableType.name.value === "Boolean"
      );
    },
  );
  const { coerced, errors } = getVariableValues(
    schema,
    directiveVariables,
    variables,
  );
  if (errors) {
    throw errors[0];
  }

  const fragments = Object.fromEntries(
    document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ),
  );
  const fields = collectFields(
    schema,
    fragments,
    coerced,
    mutationType,
    operation.selectionSet,
  );
  return Array.from(fields.values(), ([first, ...rest]) => ({
    ...first,
    selectionSet: first.selectionSet && {
      ...first.selectionSet,
      selections: [
        ...first.selectionSet.selections,
        ...rest.flatMap((node) => node.selectionSet?.selections ?? []),
      ],
    },
  }));
}

/**
 * Reads the configured cost of executing a root mutation.
 * @param field - The root mutation field definition.
 * @returns The configured base cost or the default of ten points.
 */
function mutationBaseCost(field: GraphQLField<unknown, unknown>): number {
  const { mutationComplexity } = field.extensions;
  return typeof mutationComplexity === "number" ? mutationComplexity : 10;
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
    const { maxComplexity } = this.options;
    const estimateDirective = directiveEstimator();
    const fieldEstimators: ComplexityEstimator[] = [
      // Directive multipliers reserve capacity for the requested selection.
      (args) =>
        estimateDirective("resolved" in args ? { ...args, args: {} } : args),
      fieldExtensionsEstimator(),
    ];
    const fallbackEstimators = [compositeFieldEstimator, this.defaultEstimator];
    const estimateCost = (
      args: ComplexityEstimatorArgs & FieldComplexityEstimatorArgs,
      isRootMutation: boolean,
    ): number => {
      const resultCost = estimateFieldCost(fieldEstimators, args);
      return isRootMutation
        ? mutationBaseCost(args.field) + (resultCost ?? args.childComplexity)
        : (resultCost ?? estimateFieldCost(fallbackEstimators, args) ?? 0);
    };

    const cost: CostResponse = {
      requestedQueryCost: 0,
      actualQueryCost: 0,
    };

    return {
      didResolveOperation: async (args) => {
        const { request, document, operation } = args;
        let query = document;
        let mutationSelections: Set<FieldNode> | undefined;
        if (operation?.operation === OperationTypeNode.MUTATION) {
          const selections = collectMutationSelections(
            schema,
            document,
            operation,
            request.variables ?? {},
          );
          query = {
            ...document,
            definitions: document.definitions.map((definition) =>
              definition === operation
                ? {
                    ...operation,
                    selectionSet: { ...operation.selectionSet, selections },
                  }
                : definition,
            ),
          };
          mutationSelections = new Set(selections);
        }

        cost.requestedQueryCost = getComplexity({
          schema,
          operationName: request.operationName,
          query,
          variables: request.variables,
          estimators: [
            (field) =>
              estimateCost(
                field,
                field.field.name !== "__typename" &&
                  mutationSelections?.has(field.node) === true,
              ),
          ],
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
            const isRootMutation =
              info.operation?.operation === OperationTypeNode.MUTATION &&
              info.path?.prev === undefined;

            const estimatorArgs: ComplexityEstimatorArgs = {
              childComplexity: 0,
              args,
              field,
              node: info.fieldNodes[0],
              type: info.parentType,
            };

            return (error, result: unknown) => {
              if (error === null) {
                cost.actualQueryCost += estimateCost(
                  {
                    ...estimatorArgs,
                    resolved: { result },
                  },
                  isRootMutation,
                );
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
