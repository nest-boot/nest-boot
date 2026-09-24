import z from "zod";
import { WorkspaceOrderField } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";
import {
  createDataFilterDateSearchSchema,
  createDataFilterInputSearchSchema,
} from "@/lib/data-filter-search-schema";

export const workspaceSearchSchema = createConnectionSearchSchema({
  filterSchema: z
    .object({
      name: createDataFilterInputSearchSchema().optional().catch(undefined),
      created_at: createDataFilterDateSearchSchema()
        .optional()
        .catch(undefined),
    })
    .optional(),
  pageSize: 20,
  orderField: WorkspaceOrderField,
  defaultOrderField: WorkspaceOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
