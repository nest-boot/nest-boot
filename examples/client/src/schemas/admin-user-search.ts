import { UserOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterSearchSchema,
  createFilterSchema,
  createInputFilterSearchSchema,
} from "@/lib/connection-search";

export const adminUserSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterSearchSchema(),
    email: createInputFilterSearchSchema(),
    created_at: createDateFilterSearchSchema(),
  }),
  pageSize: 20,
  orderField: UserOrderField,
  defaultOrderField: UserOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
