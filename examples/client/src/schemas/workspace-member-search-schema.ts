import z from "zod";
import {
  WorkspaceMemberOrderField,
  WorkspaceMemberStatus,
  WorkspaceMemberType,
} from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const workspaceMemberSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(z.string().max(255)),
    email: createInputFilterItemSearchSchema(z.string().max(255)),
    type: createSelectFilterItemSearchSchema(
      z.nativeEnum(WorkspaceMemberType),
      Object.values(WorkspaceMemberType).length,
    ),
    status: createSelectFilterItemSearchSchema(
      z.union([z.nativeEnum(WorkspaceMemberStatus), z.literal("ACTIVE")]),
      Object.values(WorkspaceMemberStatus).length + 1,
    ),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: WorkspaceMemberOrderField,
  defaultOrderField: WorkspaceMemberOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
