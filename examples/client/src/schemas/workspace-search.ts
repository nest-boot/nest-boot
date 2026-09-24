import { WorkspaceOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterSearchSchema,
  createFilterSchema,
  createInputFilterSearchSchema,
} from "@/lib/connection-search";

export const workspaceSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterSearchSchema(),
    created_at: createDateFilterSearchSchema(),
  }),
  pageSize: 20,
  orderField: WorkspaceOrderField,
  defaultOrderField: WorkspaceOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
