import type {
  ZodClass,
  ZodDtoData,
  ZodDtoMerge,
  ZodFieldDefinition,
  ZodMappedTypeFactory,
  ZodObjectOptions,
} from "../types.js";
import {
  getZodFields,
  getZodObjectOptions,
  registerZodField,
  registerZodObject,
} from "./metadata.js";

function createMappedClass<T extends object>(name: string): ZodClass<T> {
  class MappedClass {}

  Object.defineProperty(MappedClass, "name", { value: name });
  return MappedClass as ZodClass<T>;
}

function copyFields(
  source: ZodClass,
  target: ZodClass,
  include: (propertyName: string) => boolean = () => true,
  transform: (definition: ZodFieldDefinition) => ZodFieldDefinition = (
    definition,
  ) => definition,
): void {
  for (const [propertyName, definition] of getZodFields(source)) {
    if (include(propertyName)) {
      registerZodField(target.prototype, propertyName, transform(definition));
    }
  }
}

function optionalDefinition(
  definition: ZodFieldDefinition,
): ZodFieldDefinition {
  return typeof definition === "function"
    ? (zod) => definition(zod).optional()
    : definition.optional();
}

function copyUnknownKeysPolicy(sources: ZodClass[], target: ZodClass): void {
  const options = sources.flatMap(getZodObjectOptions);
  const unknownKeys = options.reduce<ZodObjectOptions["unknownKeys"]>(
    (mode, current) => current.unknownKeys ?? mode,
    undefined,
  );

  // Register even an empty policy so mapped DTOs without fields still produce
  // an empty object schema instead of being treated as undecorated classes.
  registerZodObject(target, { unknownKeys });
}

/**
 * Creates a partial DTO while preserving Zod field metadata.
 *
 * @param source - DTO whose decorated fields become optional
 * @param factory - Optional Nest mapped-type helper, such as GraphQL's
 * `PartialType`
 * @returns A mapped class with optional Zod fields
 */
export function ZodPartialType<T extends object>(
  source: ZodClass<T>,
  factory: ZodMappedTypeFactory<T, Partial<ZodDtoData<T>>> = () =>
    createMappedClass(`Partial${source.name}`),
): ZodClass<Partial<ZodDtoData<T>>> {
  const target = factory(source);
  copyFields(source, target, undefined, optionalDefinition);
  copyUnknownKeysPolicy([source], target);
  return target;
}

/**
 * Creates a DTO containing selected fields while preserving Zod field metadata.
 *
 * @param source - DTO to select fields from
 * @param keys - Data-property names to include
 * @param factory - Optional Nest mapped-type helper, such as GraphQL's
 * `PickType`
 * @returns A mapped class containing the selected Zod fields
 */
export function ZodPickType<
  T extends object,
  Key extends Extract<keyof ZodDtoData<T>, string>,
>(
  source: ZodClass<T>,
  keys: readonly Key[],
  factory: ZodMappedTypeFactory<
    T,
    Pick<ZodDtoData<T>, Key>,
    [readonly Key[]]
  > = () => createMappedClass(`Pick${source.name}`),
): ZodClass<Pick<ZodDtoData<T>, Key>> {
  const target = factory(source, keys);
  const selected = new Set<string>(keys);
  copyFields(source, target, (propertyName) => selected.has(propertyName));
  copyUnknownKeysPolicy([source], target);
  return target;
}

/**
 * Creates a DTO without selected fields while preserving Zod field metadata.
 *
 * @param source - DTO to remove fields from
 * @param keys - Data-property names to exclude
 * @param factory - Optional Nest mapped-type helper, such as GraphQL's
 * `OmitType`
 * @returns A mapped class without the selected Zod fields
 */
export function ZodOmitType<
  T extends object,
  Key extends Extract<keyof ZodDtoData<T>, string>,
>(
  source: ZodClass<T>,
  keys: readonly Key[],
  factory: ZodMappedTypeFactory<
    T,
    Omit<ZodDtoData<T>, Key>,
    [readonly Key[]]
  > = () => createMappedClass(`Omit${source.name}`),
): ZodClass<Omit<ZodDtoData<T>, Key>> {
  const target = factory(source, keys);
  const omitted = new Set<string>(keys);
  copyFields(source, target, (propertyName) => !omitted.has(propertyName));
  copyUnknownKeysPolicy([source], target);
  return target;
}

/**
 * Creates an intersection DTO while preserving Zod field metadata from both
 * inputs. Fields from the second DTO override fields with the same name from
 * the first at runtime and in the inferred output type.
 *
 * @param first - First DTO in the intersection
 * @param second - Second DTO in the intersection
 * @param factory - Optional Nest mapped-type helper, such as GraphQL's
 * `IntersectionType`
 * @returns A mapped class containing both DTO field sets
 */
export function ZodIntersectionType<
  First extends object,
  Second extends object,
>(
  first: ZodClass<First>,
  second: ZodClass<Second>,
  factory: ZodMappedTypeFactory<
    First,
    ZodDtoMerge<First, Second>,
    [ZodClass<Second>]
  > = () => createMappedClass(`Intersection${first.name}${second.name}`),
): ZodClass<ZodDtoMerge<First, Second>> {
  const target = factory(first, second);
  copyFields(first, target);
  copyFields(second, target);
  copyUnknownKeysPolicy([first, second], target);
  return target;
}
