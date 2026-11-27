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
  GraphQLError,
  type GraphQLField,
  type GraphQLSchema,
  isCompositeType,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
  TypeNameMetaFieldDef,
} from "graphql/index.js";
import {
  type ComplexityEstimator,
  type ComplexityEstimatorArgs,
  directiveEstimator,
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from "graphql-query-complexity";

import { OPTIONS_TOKEN } from "./graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitStorage } from "./graphql-rate-limit.storage.js";
import type {
  CostResponse,
  GraphQLRateLimitOptions,
} from "./interfaces/index.js";

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

/**
 * Checks whether an error came from GraphQL variable coercion.
 * @param error - The thrown value to inspect.
 * @returns Whether the error is a variable coercion error.
 */
function isVariableCoercionError(error: unknown): error is GraphQLError {
  if (!(error instanceof GraphQLError) || error.nodes?.length !== 1) {
    return false;
  }

  const [node] = error.nodes;
  if (node.kind !== Kind.VARIABLE_DEFINITION) {
    return false;
  }

  const variableName = node.variable.name.value;
  return (
    error.message.startsWith(`Variable "$${variableName}" has invalid value`) ||
    error.message.startsWith(
      `Variable "$${variableName}" got invalid value `,
    ) ||
    error.message.startsWith(`Variable "$${variableName}" of required type `) ||
    error.message.startsWith(`Variable "$${variableName}" of non-null type `)
  );
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
      if (args.node.name.value === TypeNameMetaFieldDef.name) {
        return 0;
      }

      const resultCost = estimateFieldCost(fieldEstimators, args);
      return isRootMutation
        ? mutationBaseCost(args.field) + (resultCost ?? args.childComplexity)
        : (resultCost ?? estimateFieldCost(fallbackEstimators, args) ?? 0);
    };

    const cost: CostResponse = {
      requestedQueryCost: 0,
      actualQueryCost: 0,
    };
    let deferredVariableError: GraphQLError | undefined;
    let reserved = false;

    return {
      didResolveOperation: async (args) => {
        const { request, document, operation } = args;
        if (!operation) {
          return;
        }

        try {
          let query = document;
          let mutationSelections: Set<FieldNode> | undefined;
          if (operation.operation === OperationTypeNode.MUTATION) {
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
                  mutationSelections?.has(field.node) === true,
                ),
            ],
          });
        } catch (error) {
          // Let Apollo's execution pipeline coerce variables so all BAD_USER_INPUT
          // errors, their order, and HTTP status handling match unthrottled requests.
          if (isVariableCoercionError(error)) {
            deferredVariableError = error;
            return;
          }
          throw error;
        }

        if (cost.requestedQueryCost > maxComplexity) {
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

        reserved = true;
      },
      executionDidStart: async () => {
        if (!reserved) {
          const error = deferredVariableError;
          return error
            ? {
                willResolveField: () => {
                  throw error;
                },
              }
            : undefined;
        }

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
          reserved &&
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
