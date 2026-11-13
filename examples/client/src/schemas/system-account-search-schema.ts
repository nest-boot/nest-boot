import { SystemAccountOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const systemAccountSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: SystemAccountOrderField,
  defaultOrderField: SystemAccountOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
