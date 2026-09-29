import { UserOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const adminUserSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(),
    email: createInputFilterItemSearchSchema(),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: UserOrderField,
  defaultOrderField: UserOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
