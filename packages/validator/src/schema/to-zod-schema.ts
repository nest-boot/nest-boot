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

function normalizePassthroughOutput(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  // Data descriptors avoid invoking inherited setters for special key names.
  for (const [key, propertyValue] of Object.entries(value)) {
    Object.defineProperty(output, key, {
      configurable: true,
      enumerable: true,
      value: propertyValue,
      writable: true,
    });
  }

  return output;
}

function createObjectSchema(
  shape: Record<string, z.ZodType>,
  unknownKeys: ZodUnknownKeysMode,
): z.ZodObject {
  switch (unknownKeys) {
    case "strict":
      return z.strictObject(shape);
    case "passthrough":
      return z.looseObject(shape).overwrite(normalizePassthroughOutput);
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

  const shape = Object.create(null) as Record<string, z.ZodType>;

  for (const [propertyName, definition] of fields) {
    shape[propertyName] =
      typeof definition === "function"
        ? z.lazy(() => definition(z))
        : definition;
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
 * The inferred output uses all of the class's non-function data properties,
 * while the runtime shape contains only properties registered with
 * {@link ZodField}. An undecorated property therefore remains visible to
 * TypeScript but is not validated or preserved by the default object schema.
 * Decorate every property that must be present in parsed output, and keep its
 * declaration aligned with any schema coercions or transforms.
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
