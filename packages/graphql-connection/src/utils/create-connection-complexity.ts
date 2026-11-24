import type { FilterQuery } from "@mikro-orm/core";
import type {
  ComplexityEstimator,
  FieldComplexityEstimatorArgs,
} from "@nest-boot/graphql";
import { isPlainObject } from "lodash-es";

import type {
  ConnectionArgsInterface,
  ConnectionMetadata,
  ConnectionResult,
} from "../interfaces/index.js";
import { parseConnectionQuery } from "./parse-connection-query.js";
import { resolveConnectionPagination } from "./resolve-connection-pagination.js";

const logicalOperators = new Set(["$and", "$or", "$not"]);

/**
 * Counts comparisons, logical groups, and the terms in comparison lists.
 * @param filter - A normalized connection filter or a term in it.
 * @returns The structural complexity of the filter.
 */
function filterComplexity(filter: unknown): number {
  if (filter == null) {
    return 0;
  }
  if (Array.isArray(filter)) {
    return (filter as unknown[]).reduce<number>(
      (cost, term) => cost + filterComplexity(term),
      0,
    );
  }
  if (!isPlainObject(filter)) {
    return 1;
  }

  let cost = 0;
  for (const [key, value] of Object.entries(filter)) {
    if (logicalOperators.has(key)) {
      cost += 1 + filterComplexity(value);
    } else if (key.startsWith("$")) {
      cost += Array.isArray(value) ? Math.max(1, value.length) : 1;
    } else {
      cost += Math.max(1, filterComplexity(value));
    }
  }
  return cost;
}

/**
 * Estimates the cost of applying the two client filters to one database query.
 * @param query - The caller's search expression.
 * @param filter - The GraphQL-coerced filter.
 * @param metadata - Filterable fields and the connection's filter schema.
 * @returns The cost of the conditions for one page.
 */
function estimateConnectionFilterComplexity<Entity extends object>(
  query: string | null,
  filter: unknown,
  metadata: Pick<
    ConnectionMetadata<Entity>,
    "fieldOptionsMap" | "filterQuerySchema"
  >,
): number {
  const explicitCost = filterComplexity(filter);
  let searchFilter: FilterQuery<Entity> | null;
  try {
    searchFilter = parseConnectionQuery(query, metadata);
  } catch {
    // The resolver still validates search expressions and reports its usual error.
    return explicitCost;
  }

  const searchCost = filterComplexity(searchFilter);
  const combineCost = explicitCost > 0 && searchCost > 0 ? 1 : 0;
  return explicitCost + searchCost + combineCost;
}

/**
 * Creates a GraphQL field complexity estimator using a connection's filters.
 * @template Entity - The entity type being queried.
 * @param metadata - Filterable fields and the connection's filter schema.
 * @returns An estimator that prices the page and its filters.
 */
export function createConnectionComplexity<Entity extends object>(
  metadata: Pick<
    ConnectionMetadata<Entity>,
    "fieldOptionsMap" | "filterQuerySchema"
  >,
): ComplexityEstimator {
  return ({
    args,
    childComplexity,
    resolved,
  }: FieldComplexityEstimatorArgs<ConnectionResult<Entity>>) => {
    const { query, filter } = args as ConnectionArgsInterface<Entity>;
    const pagination = resolveConnectionPagination(args);
    if ("error" in pagination) {
      return 0;
    }

    const baseCost =
      2 + estimateConnectionFilterComplexity(query ?? null, filter, metadata);
    if (resolved) {
      const { result } = resolved;
      return (
        baseCost + (Array.isArray(result?.edges) ? result.edges.length : 0)
      );
    }

    return baseCost + pagination.limit * (1 + Math.max(0, childComplexity));
  };
}
