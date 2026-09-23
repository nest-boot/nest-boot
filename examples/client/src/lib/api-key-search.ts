import z from "zod";
import type { UserApiKey } from "@/gql/graphql";
import { UserApiKeyOrderField } from "@/gql/graphql";
import { encodeConnectionCursor } from "@/lib/connection-cursor";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";
import {
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";

export const apiKeySearchSchema = createConnectionSearchSchema({
  filterSchema: z
    .object({
      name: createDataFilterInputSearchSchema(z.string().max(255), {
        fulltext: true,
      })
        .optional()
        .catch(undefined),
      prefix: createDataFilterInputSearchSchema().optional().catch(undefined),
      created_at: dataFilterDateSearchSchema.optional().catch(undefined),
    })
    .optional(),
  pageSize: 20,
  orderField: UserApiKeyOrderField,
  defaultOrderField: UserApiKeyOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export type ApiKeySearch = z.infer<typeof apiKeySearchSchema>;

export const userApiKeysPageKey = ["user", "api-keys"] as const;

export const getWorkspaceApiKeysPageKey = (workspaceId: string) =>
  ["workspaces", workspaceId, "api-keys"] as const;

export function createApiKeyCursor(
  apiKey: Pick<UserApiKey, "id" | "createdAt" | "lastUsedAt">,
  search: ApiKeySearch,
) {
  const field = search.orderBy?.field ?? UserApiKeyOrderField.CREATED_AT;
  const values = {
    [UserApiKeyOrderField.ID]: apiKey.id,
    [UserApiKeyOrderField.CREATED_AT]: apiKey.createdAt,
    [UserApiKeyOrderField.LAST_USED_AT]: apiKey.lastUsedAt ?? null,
  };
  return encodeConnectionCursor({ id: apiKey.id, value: values[field] });
}

/** Converts either API-key route's search state into connection variables. */
export function createApiKeyQueryVariables(search: ApiKeySearch) {
  const { query, filter, orderBy, ...pagination } = search;
  return {
    ...pagination,
    query: query ?? "",
    filter: formatFilterValues(
      (filter ?? {}) as Record<string, unknown>,
      formatConnectionFilterValue,
    ),
    orderBy: {
      field: orderBy?.field ?? UserApiKeyOrderField.CREATED_AT,
      direction: orderBy?.direction ?? OrderDirection.DESC,
    },
  };
}
