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

export function createFilterSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape).optional();
}

export function createInputFilterItemSearchSchema(
  valueSchema: z.ZodString = z.string().max(255),
  options: { fulltext?: boolean } = {},
) {
  const nullableValueSchema = valueSchema.nullable();
  const operatorSchema = {
    $eq: nullableValueSchema.optional(),
    $ne: nullableValueSchema.optional(),
    ...(options.fulltext ? { $fulltext: valueSchema.optional() } : {}),
  };

  return z
    .union([valueSchema, z.object(operatorSchema).strict()])
    .optional()
    .catch(undefined);
}

export function createSelectFilterItemSearchSchema<
  ValueSchema extends z.ZodTypeAny,
>(valueSchema: ValueSchema, max?: number) {
  const arraySchema =
    typeof max === "number"
      ? z.array(valueSchema).max(max)
      : z.array(valueSchema);

  return z
    .union([
      arraySchema,
      z
        .object({
          $eq: z.null().optional(),
          $ne: z.null().optional(),
          $in: arraySchema.optional(),
          $nin: arraySchema.optional(),
        })
        .strict(),
    ])
    .optional()
    .catch(undefined);
}

export function createDateFilterItemSearchSchema() {
  const dateValueSchema = z.string().datetime();

  return z
    .union([
      dateValueSchema,
      z
        .object({
          $eq: dateValueSchema.nullable().optional(),
          $ne: dateValueSchema.nullable().optional(),
          $gt: dateValueSchema.optional(),
          $gte: dateValueSchema.optional(),
          $lt: dateValueSchema.optional(),
          $lte: dateValueSchema.optional(),
        })
        .strict(),
    ])
    .optional()
    .catch(undefined);
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
        .default({
          field: options.defaultOrderField,
          direction: options.defaultOrderDirection,
        }),
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
