import z from "zod";
import { UserOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";

export const adminUserSearchSchema = createConnectionSearchSchema({
  filterSchema: z
    .object({
      name: createDataFilterInputSearchSchema().optional().catch(undefined),
      email: createDataFilterInputSearchSchema().optional().catch(undefined),
      created_at: dataFilterDateSearchSchema.optional().catch(undefined),
    })
    .optional(),
  pageSize: 20,
  orderField: UserOrderField,
  defaultOrderField: UserOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export const adminUsersResourceKey = ["admin", "users"] as const;
