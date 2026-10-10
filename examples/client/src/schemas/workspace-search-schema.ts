import { WorkspaceOrderField } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const workspaceSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: WorkspaceOrderField,
  defaultOrderField: WorkspaceOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
