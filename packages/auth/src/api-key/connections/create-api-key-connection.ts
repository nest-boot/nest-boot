import type { EntityClass } from "@mikro-orm/core";
import { ObjectType } from "@nest-boot/graphql";
import {
  type ConnectionFieldOptions,
  createConnection,
  createConnectionArgs,
  createEdge,
  createFilter,
  createOrder,
} from "@nest-boot/graphql-connection";

import { ApiKey } from "../entities/api-key.entity.js";
import type { ApiKeyFields } from "../entities/api-key-fields.js";

/**
 * Keeps GraphQL node types separate while querying the shared persistence entity.
 * Scoped services always add an owner discriminator and authorization conditions.
 * @param view - GraphQL credential type for this connection.
 * @returns Scoped connection and pagination arguments backed by the API-key table.
 * @internal
 */
export function createApiKeyConnection<Key extends ApiKeyFields>(
  view: EntityClass<Key>,
) {
  const fields = new Map<string, ConnectionFieldOptions<Key>>([
    [
      "name",
      { field: "name", type: "string", searchable: true, filterable: true },
    ],
    ["prefix", { field: "prefix", type: "string", filterable: true }],
    ["enabled", { field: "enabled", type: "boolean", filterable: true }],
    [
      "last_used_at",
      {
        field: "last_used_at",
        replacement: "lastUsedAt",
        type: "date",
        filterable: true,
        sortable: true,
      },
    ],
    [
      "created_at",
      {
        field: "created_at",
        replacement: "createdAt",
        type: "date",
        filterable: true,
        sortable: true,
      },
    ],
  ]);
  const Edge = createEdge(view, view.name);
  ObjectType(`${view.name}Edge`, { isAbstract: true })(Edge);
  const { Order } = createOrder(view.name, fields);
  const { Filter, filterQuerySchema } = createFilter(view.name, fields, {
    maxDepth: 5,
    maxConditions: 20,
    maxOrBranches: 5,
    maxArrayLength: 100,
  });
  // Only this boundary projects shared persistence to the service-checked public view.
  const Connection = createConnection(
    ApiKey as unknown as EntityClass<Key>,
    view.name,
    Edge,
    fields,
    filterQuerySchema,
  );
  const ConnectionArgs = createConnectionArgs(view.name, fields, Order, Filter);
  return { Connection, ConnectionArgs };
}
