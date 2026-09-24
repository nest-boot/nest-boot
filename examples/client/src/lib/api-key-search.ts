import z from "zod";
import { UserApiKeyOrderField } from "@/gql/graphql";
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

export const userApiKeysResourceKey = ["user", "api-keys"] as const;

export const getWorkspaceApiKeysResourceKey = (workspaceId: string) =>
  ["workspaces", workspaceId, "api-keys"] as const;

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
    orderBy,
  };
}
