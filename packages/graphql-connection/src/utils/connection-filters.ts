import type { FilterQuery } from "@mikro-orm/core";
import { compact } from "lodash-es";

import type {
  ConnectionMetadata,
  CountArgsInterface,
} from "../interfaces/index.js";
import { parseConnectionQuery } from "./parse-connection-query.js";

/**
 * Returns the where clauses shared by a connection's list and count.
 * @template Entity - The entity type.
 * @param metadata - Connection field and filter definitions.
 * @param args - Search and filter input arguments.
 * @param where - Server-supplied scope and permission constraints.
 * @returns The filters before applying a page cursor.
 */
export function connectionFilters<Entity extends object>(
  metadata: ConnectionMetadata<Entity>,
  args: CountArgsInterface<Entity>,
  where?: FilterQuery<Entity>,
): FilterQuery<Entity>[] {
  return compact([
    where,
    parseConnectionQuery(args.query, metadata),
    args.filter,
  ]);
}

/**
 * Conjoins the filters without changing the individual conditions.
 * @template Entity - The entity type.
 * @param filters - The conditions to apply.
 * @returns The resulting filter, or null when it is unrestricted.
 */
export function combineConnectionFilters<Entity extends object>(
  filters: FilterQuery<Entity>[],
): FilterQuery<Entity> | null {
  if (filters.length === 0) {
    return null;
  }
  return filters.length === 1
    ? filters[0]
    : ({ $and: filters } as FilterQuery<Entity>);
}
