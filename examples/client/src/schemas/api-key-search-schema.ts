import z from "zod";
import { ApiKeyOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const apiKeySearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(z.string().max(255), {
      fulltext: true,
    }),
    prefix: createInputFilterItemSearchSchema(),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: ApiKeyOrderField,
  defaultOrderField: ApiKeyOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export type ApiKeySearch = z.infer<typeof apiKeySearchSchema>;
