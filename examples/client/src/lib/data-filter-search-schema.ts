import z from "zod";
import type { ZodString, ZodTypeAny } from "zod";

export function createDataFilterInputSearchSchema(
  valueSchema: ZodString = z.string().max(255),
  options: { fulltext?: boolean } = {},
) {
  const nullableValueSchema = valueSchema.nullable();
  const operatorSchema = {
    $eq: nullableValueSchema.optional(),
    $ne: nullableValueSchema.optional(),
    ...(options.fulltext ? { $fulltext: valueSchema.optional() } : {}),
  };

  return z.union([valueSchema, z.object(operatorSchema).strict()]);
}

export function createDataFilterSelectSearchSchema<
  ValueSchema extends ZodTypeAny,
>(valueSchema: ValueSchema, max?: number) {
  const arraySchema =
    typeof max === "number"
      ? z.array(valueSchema).max(max)
      : z.array(valueSchema);

  return z.union([
    arraySchema,
    z
      .object({
        $eq: z.null().optional(),
        $ne: z.null().optional(),
        $in: arraySchema.optional(),
        $nin: arraySchema.optional(),
      })
      .strict(),
  ]);
}

const dateValueSchema = z.string().datetime();

export const dataFilterDateSearchSchema = z.union([
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
]);
