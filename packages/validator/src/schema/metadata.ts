import type {
  ZodClass,
  ZodFieldDefinition,
  ZodObjectOptions,
} from "../types.js";

const fieldsByPrototype = new WeakMap<
  object,
  Map<string, ZodFieldDefinition>
>();
const optionsByClass = new WeakMap<ZodClass, Readonly<ZodObjectOptions>>();

let metadataVersion = 0;

/**
 * Stores a field schema and advances the metadata version.
 * @param target - Object that receives the configuration.
 * @param propertyName - Name of the decorated DTO property.
 * @param definition - Field schema or schema factory.
 */
export function registerZodField(
  target: object,
  propertyName: string,
  definition: ZodFieldDefinition,
): void {
  let fields = fieldsByPrototype.get(target);

  if (!fields) {
    fields = new Map();
    fieldsByPrototype.set(target, fields);
  }

  fields.set(propertyName, definition);
  metadataVersion += 1;
}

/**
 * Stores object-level schema options and advances the metadata version.
 * @param target - Object that receives the configuration.
 * @param options - Configuration for this operation.
 */
export function registerZodObject(
  target: ZodClass,
  options: ZodObjectOptions,
): void {
  optionsByClass.set(target, Object.freeze({ ...options }));
  metadataVersion += 1;
}

/**
 * Returns field definitions collected from the class and its ancestors.
 * @param target - Object that receives the configuration.
 * @returns Field definitions collected from the class and its ancestors.
 */
export function getZodFields(
  target: ZodClass,
): Map<string, ZodFieldDefinition> {
  const prototypes: object[] = [];
  let prototype: object | null = target.prototype;

  while (prototype && prototype !== Object.prototype) {
    prototypes.unshift(prototype);
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }

  const fields = new Map<string, ZodFieldDefinition>();

  for (const current of prototypes) {
    for (const [propertyName, definition] of fieldsByPrototype.get(current) ??
      []) {
      fields.set(propertyName, definition);
    }
  }

  return fields;
}

/**
 * Returns object options collected from the class metadata.
 * @param target - Object that receives the configuration.
 * @returns Object options collected from the class metadata.
 */
export function getZodObjectOptions(
  target: ZodClass,
): Readonly<ZodObjectOptions>[] {
  const classes: ZodClass[] = [];
  let current: object | null = target;

  while (typeof current === "function" && current !== Function.prototype) {
    classes.unshift(current as ZodClass);
    current = Object.getPrototypeOf(current) as object | null;
  }

  return classes.flatMap((constructor) => {
    const options = optionsByClass.get(constructor);
    return options ? [options] : [];
  });
}

/**
 * Returns version incremented whenever schema metadata changes.
 * @returns Version incremented whenever schema metadata changes.
 */
export function getZodMetadataVersion(): number {
  return metadataVersion;
}
