import z from "zod";
import { MemberOrderField, MemberStatus, MemberType } from "@/gql/graphql";

import {
  OrderDirection,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
} from "@/lib/graphql-connection";

export const memberSearchSchema = createConnectionSearchSchema({
  filterSchema: createFilterSchema({
    name: createInputFilterItemSearchSchema(z.string().max(255)),
    email: createInputFilterItemSearchSchema(z.string().max(255)),
    type: createSelectFilterItemSearchSchema(
      z.nativeEnum(MemberType),
      Object.values(MemberType).length,
    ),
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
