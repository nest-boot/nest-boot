import { z } from "zod";

type EnumLike = Readonly<Record<string, string | number>>;

export enum OrderDirection {
  ASC = "ASC",
  DESC = "DESC",
}

export interface PageInfo {
  endCursor?: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
}

export interface CreateConnectionSearchSchemaOptions<
  OrderField extends EnumLike,
> {
  filterSchema?: z.ZodSchema;
  pageSize: number;
  orderField: OrderField;
  defaultOrderField: OrderField[keyof OrderField];
  defaultOrderDirection: OrderDirection;
}

export function createConnectionSearchSchema<OrderField extends EnumLike>(
  options: CreateConnectionSearchSchemaOptions<OrderField>,
) {
  return z
    .object({
      first: z
        .number()
        .int()
        .min(1)
        .max(options.pageSize)
        .optional()
        .catch(() => options.pageSize),
      last: z
        .number()
        .int()
        .min(1)
        .max(options.pageSize)
        .optional()
        .catch(() => options.pageSize),
      after: z.string().optional(),
      before: z.string().optional(),
      query: z.string().optional(),
      orderBy: z
        .object({
          field: z
            .nativeEnum(options.orderField)
            .default(options.defaultOrderField),
          direction: z
            .nativeEnum(OrderDirection)
            .default(options.defaultOrderDirection),
        })
        .optional(),
      ...(options.filterSchema ? { filter: options.filterSchema } : {}),
    })
    .transform((data) => {
      const { first, last, after, before, ...rest } = data;

      if (first !== undefined || after !== undefined) {
        return {
          ...rest,
          first: first ?? options.pageSize,
          after,
        };
      }

      if (last !== undefined || before !== undefined) {
        return {
          ...rest,
          last: last ?? options.pageSize,
          before,
        };
      }

      return {
        ...rest,
        first: options.pageSize,
      };
    });
}

export type ConnectionSearch<OrderField extends EnumLike> = z.infer<
  ReturnType<typeof createConnectionSearchSchema<OrderField>>
>;

export function getPreviousPageSearch<
  Search extends ConnectionSearch<EnumLike> = ConnectionSearch<EnumLike>,
>(search: Search, pageInfo?: PageInfo) {
  return {
    ...search,
    first: undefined,
    last: "last" in search ? search.last : search.first,
    before: pageInfo?.startCursor ?? undefined,
    after: undefined,
  };
}

export function getNextPageSearch<
  Search extends ConnectionSearch<EnumLike> = ConnectionSearch<EnumLike>,
>(search: Search, pageInfo?: PageInfo) {
  return {
    ...search,
    first: "first" in search ? search.first : search.last,
    last: undefined,
    before: undefined,
    after: pageInfo?.endCursor ?? undefined,
  };
}
