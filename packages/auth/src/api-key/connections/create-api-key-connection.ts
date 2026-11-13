import { Field, ObjectType } from "@nest-boot/graphql";
import {
  type ConnectionFieldOptions,
  createConnection,
  createConnectionArgs,
  createFilter,
  createOrder,
  type EdgeInterface,
} from "@nest-boot/graphql-connection";
import type { Type } from "@nestjs/common";

import { ApiKey } from "../entities/api-key.entity.js";
import type { ApiKeyObject } from "../objects/api-key.object.js";

/**
 * Keeps GraphQL node types separate while querying the shared persistence entity.
 * Scoped services always add an owner discriminator and authorization conditions.
 * @param view - GraphQL credential type for this connection.
 * @returns Scoped connection and pagination arguments backed by the API-key table.
 * @internal
 */
export function createApiKeyConnection<Key extends ApiKeyObject>(
  view: Type<Key>,
) {
  const fields = new Map<string, ConnectionFieldOptions<ApiKey>>([
    [
      "name",
      { field: "name", type: "string", searchable: true, filterable: true },
    ],
    ["prefix", { field: "prefix", type: "string", filterable: true }],
    [
      "revoked_at",
      {
        field: "revoked_at",
        replacement: "revokedAt",
        type: "date",
        filterable: true,
        sortable: true,
      },
    ],
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
  @ObjectType(`${view.name}Edge`, { isAbstract: true })
  class Edge implements EdgeInterface<ApiKey> {
    // eslint-disable-next-line @nest-boot/graphql-field-config-from-types -- Services project persistence rows to this DTO before GraphQL serialization.
    @Field(() => view, {
      description: `The item at the end of ${view.name}Edge.`,
    })
    node!: ApiKey;

    @Field(() => String, {
      complexity: 0,
      description: "A cursor for use in pagination.",
    })
    cursor!: string;
  }
  const { Order } = createOrder(view.name, fields);
  const { Filter, filterQuerySchema } = createFilter(view.name, fields, {
    maxDepth: 5,
    maxConditions: 20,
    maxOrBranches: 5,
    maxArrayLength: 100,
  });
  // Only this boundary projects shared persistence to the service-checked public view.
  const Connection = createConnection(
    ApiKey,
    view.name,
    Edge,
    fields,
    filterQuerySchema,
  );
  const ConnectionArgs = createConnectionArgs(view.name, fields, Order, Filter);
  return { Connection, ConnectionArgs };
}
