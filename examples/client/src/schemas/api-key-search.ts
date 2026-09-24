import z from "zod";
import { UserApiKeyOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";
import {
  createDataFilterDateSearchSchema,
  createDataFilterInputSearchSchema,
} from "@/lib/data-filter-search-schema";

export const apiKeySearchSchema = createConnectionSearchSchema({
  filterSchema: z
    .object({
      name: createDataFilterInputSearchSchema(z.string().max(255), {
        fulltext: true,
      }),
      prefix: createDataFilterInputSearchSchema(),
      created_at: createDataFilterDateSearchSchema(),
    })
    .optional(),
  pageSize: 20,
  orderField: UserApiKeyOrderField,
  defaultOrderField: UserApiKeyOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export type ApiKeySearch = z.infer<typeof apiKeySearchSchema>;
