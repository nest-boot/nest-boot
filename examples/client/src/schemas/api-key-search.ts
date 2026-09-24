import z from "zod";
import { UserApiKeyOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/connection-search";

export const apiKeySearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(z.string().max(255), {
      fulltext: true,
    }),
    prefix: createInputFilterItemSearchSchema(undefined, { fulltext: false }),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: UserApiKeyOrderField,
  defaultOrderField: UserApiKeyOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export type ApiKeySearch = z.infer<typeof apiKeySearchSchema>;
