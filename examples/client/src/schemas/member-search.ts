import z from "zod";
import { MemberOrderField, MemberStatus } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterSearchSchema,
  createFilterSchema,
  createInputFilterSearchSchema,
  createSelectFilterSearchSchema,
} from "@/lib/connection-search";

export const memberSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterSearchSchema(z.string().max(255)),
    email: createInputFilterSearchSchema(z.string().max(255)),
    status: createSelectFilterSearchSchema(
      z.union([z.nativeEnum(MemberStatus), z.literal("ACTIVE")]),
      Object.values(MemberStatus).length + 1,
    ),
    created_at: createDateFilterSearchSchema(),
  }),
  pageSize: 20,
  orderField: MemberOrderField,
  defaultOrderField: MemberOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
