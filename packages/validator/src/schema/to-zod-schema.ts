import { z } from "zod";

import type {
  DecoratedZodObject,
  ZodClass,
  ZodUnknownKeysMode,
} from "../types.js";
import {
  getZodFields,
  getZodMetadataVersion,
  getZodObjectOptions,
} from "./metadata.js";

interface CachedSchema {
  schema: z.ZodObject | undefined;
  version: number;
}

const schemaCache = new WeakMap<ZodClass, CachedSchema>();

function createObjectSchema(
  shape: Record<string, z.ZodType>,
  unknownKeys: ZodUnknownKeysMode,
): z.ZodObject {
  switch (unknownKeys) {
    case "strict":
      return z.strictObject(shape);
    case "passthrough":
      return z.looseObject(shape);
    default:
      return z.object(shape);
  }
}

/**
 * Gets the cached Zod object schema assembled from a class's decorators.
 *
 * @remarks
 * Parent fields are inherited and can be overridden by a child decorator.
 * Returns `undefined` when neither the class nor its ancestors contain Zod
 * metadata.
 *
 * @param target - The decorated class constructor
 * @returns The assembled object schema, or `undefined` for an unregistered class
 */
export function getZodSchema<T extends object>(
  target: ZodClass<T>,
): DecoratedZodObject<T> | undefined {
  const version = getZodMetadataVersion();
  const cached = schemaCache.get(target);

  if (cached?.version === version) {
    return cached.schema as DecoratedZodObject<T> | undefined;
  }

  const fields = getZodFields(target);
  const options = getZodObjectOptions(target);

  if (fields.size === 0 && options.length === 0) {
    schemaCache.set(target, { schema: undefined, version });
    return undefined;
  }

  const shape: Record<string, z.ZodType> = {};

  for (const [propertyName, factory] of fields) {
    shape[propertyName] = factory(z);
  }

  const unknownKeys =
    options.reduce<ZodUnknownKeysMode | undefined>(
      (mode, current) => current.unknownKeys ?? mode,
      undefined,
    ) ?? "strip";

  let schema = createObjectSchema(shape, unknownKeys);

  for (const current of options) {
    schema = current.configure?.(schema as DecoratedZodObject) ?? schema;
  }

  schemaCache.set(target, { schema, version });
  return schema as DecoratedZodObject<T>;
}

/**
 * Converts a decorated class to a typed Zod object schema.
 *
 * @remarks
 * The inferred output uses the class instance type. Keep property declarations
 * aligned with the output of transforms used in {@link ZodField} schemas.
 *
 * @param target - The decorated class constructor
 * @returns The assembled object schema
 */
export function toZodSchema<T extends object>(
  target: ZodClass<T>,
): DecoratedZodObject<T> {
  const schema = getZodSchema(target);

  if (!schema) {
    throw new TypeError(
      `${target.name || "Anonymous class"} has no ZodField or ZodObject metadata`,
    );
  }

  return schema;
}
