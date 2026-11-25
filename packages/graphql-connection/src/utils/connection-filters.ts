import type { FilterQuery } from "@mikro-orm/core";

import { GRAPHQL_CONNECTION_METADATA } from "../graphql-connection.constants.js";
import type {
  ConnectionMetadata,
  CountArgsInterface,
} from "../interfaces/index.js";
import type { ConnectionClass } from "../types/index.js";
import { parseConnectionQuery } from "./parse-connection-query.js";

/**
 * Resolves the query metadata attached to a generated connection or subclass.
 * @template Entity - The entity type.
 * @param connection - The generated connection.
 * @returns The connection's entity, fields and filter schema.
 * @throws {Error} The class does not have connection metadata.
 */
export function getConnectionMetadata<Entity extends object>(
  connection: ConnectionClass<Entity>,
): ConnectionMetadata<Entity> {
  const metadata: ConnectionMetadata<Entity> | undefined = Reflect.getMetadata(
    GRAPHQL_CONNECTION_METADATA,
    connection,
  );
  if (!metadata) {
    throw new Error("Connection metadata not found");
  }
  return metadata;
}

/**
 * Combines the application scope, client filters, and optional page boundary.
 * @template Entity - The entity type.
 * @param metadata - Connection field and filter definitions.
 * @param args - Search and filter input arguments.
 * @param where - Server-supplied scope and permission constraints.
 * @param cursorWhere - Page boundary when querying a list.
 * @returns The combined condition, or null when it is unrestricted.
 */
export function getConnectionWhere<Entity extends object>(
  metadata: ConnectionMetadata<Entity>,
  args: CountArgsInterface<Entity>,
  where?: FilterQuery<Entity>,
  cursorWhere?: FilterQuery<Entity> | null,
): FilterQuery<Entity> | null {
  const filters = [
    cursorWhere,
    where,
    parseConnectionQuery(args.query, metadata),
    args.filter,
  ].filter((filter) => filter != null);

  if (filters.length === 0) {
    return null;
  }
  return filters.length === 1
    ? filters[0]
    : ({ $and: filters } as FilterQuery<Entity>);
}
