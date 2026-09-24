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

interface ConnectionPaginationOptions<OrderField extends EnumLike> {
  pageSize: number;
  orderField: OrderField;
  defaultOrderField: OrderField[keyof OrderField];
  defaultOrderDirection: OrderDirection;
}

export type CreateConnectionSearchSchemaOptions<
  OrderField extends EnumLike,
  FilterSchema extends z.ZodType | undefined = undefined,
> = ConnectionPaginationOptions<OrderField> &
  (FilterSchema extends z.ZodType
    ? { filterSchema: FilterSchema }
    : { filterSchema?: undefined });

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
    $fulltext:
      options.fulltext === false
        ? z.never().optional()
        : valueSchema.optional(),
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

function createComparableFilterItemSearchSchema<ValueSchema extends z.ZodType>(
  valueSchema: ValueSchema,
) {
  return z
    .union([
      valueSchema,
      z
        .object({
          $eq: valueSchema.nullable().optional(),
          $ne: valueSchema.nullable().optional(),
          $gt: valueSchema.optional(),
          $gte: valueSchema.optional(),
          $lt: valueSchema.optional(),
          $lte: valueSchema.optional(),
          $between: z.tuple([valueSchema, valueSchema]).optional(),
        })
        .strict(),
    ])
    .optional()
    .catch(undefined);
}

export function createDateFilterItemSearchSchema() {
  return createComparableFilterItemSearchSchema(z.string().datetime());
}

export function createNumberFilterItemSearchSchema(
  valueSchema: z.ZodNumber = z.number(),
) {
  return createComparableFilterItemSearchSchema(valueSchema);
}

export function createCheckboxFilterItemSearchSchema() {
  const valueSchema = z.boolean();

  return z
    .union([
      valueSchema,
      z
        .object({
          $eq: valueSchema.nullable().optional(),
          $ne: valueSchema.nullable().optional(),
        })
        .strict(),
    ])
    .optional()
    .catch(undefined);
}

function createConnectionPaginationSchema<OrderField extends EnumLike>(
  options: ConnectionPaginationOptions<OrderField>,
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

export function createConnectionSearchSchema<
  OrderField extends EnumLike,
  FilterSchema extends z.ZodType,
>(
  options: ConnectionPaginationOptions<OrderField> & {
    filterSchema: FilterSchema;
  },
): z.ZodIntersection<
  ReturnType<typeof createConnectionPaginationSchema<OrderField>>,
  z.ZodObject<{ filter: FilterSchema }>
>;
export function createConnectionSearchSchema<OrderField extends EnumLike>(
  options: CreateConnectionSearchSchemaOptions<OrderField>,
): ReturnType<typeof createConnectionPaginationSchema<OrderField>>;
export function createConnectionSearchSchema<OrderField extends EnumLike>(
  options: ConnectionPaginationOptions<OrderField> & {
    filterSchema?: z.ZodType;
  },
) {
  const paginationSchema = createConnectionPaginationSchema(options);

  return options.filterSchema
    ? paginationSchema.and(z.object({ filter: options.filterSchema }))
    : paginationSchema;
}

export type ConnectionSearch<
  OrderField extends EnumLike,
  FilterSchema extends z.ZodType | undefined = undefined,
> = z.infer<
  FilterSchema extends z.ZodType
    ? ReturnType<typeof createConnectionSearchSchema<OrderField, FilterSchema>>
    : ReturnType<typeof createConnectionSearchSchema<OrderField>>
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
