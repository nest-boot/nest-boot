import z from "zod";
import { UserApiKeyOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterSearchSchema,
  createFilterSchema,
  createInputFilterSearchSchema,
} from "@/lib/connection-search";

export const apiKeySearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterSearchSchema(z.string().max(255), {
      fulltext: true,
    }),
    prefix: createInputFilterSearchSchema(),
    created_at: createDateFilterSearchSchema(),
  }),
  pageSize: 20,
  orderField: UserApiKeyOrderField,
  defaultOrderField: UserApiKeyOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export type ApiKeySearch = z.infer<typeof apiKeySearchSchema>;
