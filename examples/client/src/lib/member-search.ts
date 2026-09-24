import z from "zod";
import { MemberOrderField, MemberStatus } from "@/gql/graphql";
import {
  OrderDirection,
  createConnectionSearchSchema,
} from "@/lib/connection-search";
import {
  createDataFilterInputSearchSchema,
  createDataFilterSelectSearchSchema,
  dataFilterDateSearchSchema,
} from "@/lib/data-filter-search-schema";

export const memberSearchSchema = createConnectionSearchSchema({
  filterSchema: z
    .object({
      name: createDataFilterInputSearchSchema(z.string().max(255))
        .optional()
        .catch(undefined),
      email: createDataFilterInputSearchSchema(z.string().max(255))
        .optional()
        .catch(undefined),
      status: createDataFilterSelectSearchSchema(
        z.union([z.nativeEnum(MemberStatus), z.literal("ACTIVE")]),
        Object.values(MemberStatus).length + 1,
      )
        .optional()
        .catch(undefined),
      created_at: dataFilterDateSearchSchema.optional().catch(undefined),
    })
    .optional(),
  pageSize: 20,
  orderField: MemberOrderField,
  defaultOrderField: MemberOrderField.CREATED_AT,
  defaultOrderDirection: OrderDirection.DESC,
});
export const getMembersPageKey = (workspaceId: string) =>
  ["workspaces", workspaceId, "members"] as const;
