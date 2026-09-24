import z from "zod";
import { MemberOrderField, MemberStatus } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
} from "@/lib/connection-search";

export const memberSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(z.string().max(255)),
    email: createInputFilterItemSearchSchema(z.string().max(255)),
    status: createSelectFilterItemSearchSchema(
      z.union([z.nativeEnum(MemberStatus), z.literal("ACTIVE")]),
      Object.values(MemberStatus).length + 1,
    ),
    created_at: createDateFilterItemSearchSchema(),
  }),
  pageSize: 20,
  orderField: MemberOrderField,
  defaultOrderField: MemberOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
