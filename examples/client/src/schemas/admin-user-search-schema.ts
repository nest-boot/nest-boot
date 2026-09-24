import { UserOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/connection-search";

export const adminUserSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(undefined, { fulltext: false }),
    email: createInputFilterItemSearchSchema(undefined, { fulltext: false }),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: UserOrderField,
  defaultOrderField: UserOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
