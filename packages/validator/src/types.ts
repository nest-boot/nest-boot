import type { Type } from "@nestjs/common";
import type { z, ZodObject, ZodOptional, ZodType } from "zod";

/** A class-like value whose instance shape is used as schema output. */
export interface ZodClass<T extends object = object> extends Type<T> {
  /** Runtime class name used in declaration errors. */
  readonly name: string;
  /** The class prototype. */
  readonly prototype: T;
}

/** Extracts data properties from a DTO, excluding instance methods. */
export type ZodDtoData<T extends object> = {
  [Key in keyof T as Key extends string
    ? NonNullable<T[Key]> extends (...args: never[]) => unknown
      ? never
      : Key
    : never]: T[Key];
};

/** Maps DTO data properties to their statically inferred Zod field types. */
export type ZodDtoShape<T extends object> = {
  [Key in Extract<keyof ZodDtoData<T>, string>]-?: Pick<
    ZodDtoData<T>,
    Key
  > extends Required<Pick<ZodDtoData<T>, Key>>
    ? ZodType<ZodDtoData<T>[Key]>
    : ZodOptional<ZodType<Exclude<ZodDtoData<T>[Key], undefined>>>;
};

/**
 * A decorated DTO schema, statically modeled by its data properties.
 *
 * @remarks Its runtime shape contains only properties registered with
 * {@link ZodField}.
 */
export type DecoratedZodObject<T extends object = Record<string, unknown>> =
  ZodObject<ZodDtoShape<T>>;

/** Creates the Nest mapped class wrapped by a Zod-aware mapped-type helper. */
export type ZodMappedTypeFactory<
  Source extends object,
  Result extends object,
  Arguments extends unknown[] = [],
> = (source: ZodClass<Source>, ...arguments_: Arguments) => ZodClass<Result>;

/** A Zod schema that validates a decorated property. */
export type ZodFieldSchema = ZodType;

/** Lazily creates the Zod schema for a decorated property. */
export type ZodFieldSchemaFactory = (zod: typeof z) => ZodFieldSchema;

/** A schema or lazy schema factory accepted by {@link ZodField}. */
export type ZodFieldDefinition = ZodFieldSchema | ZodFieldSchemaFactory;

/** Controls how an object schema handles properties without decorators. */
export type ZodUnknownKeysMode = "strip" | "strict" | "passthrough";

/** Configures the object schema associated with a decorated class. */
export interface ZodObjectOptions {
  /** How unknown properties are handled. Defaults to `strip`. */
  unknownKeys?: ZodUnknownKeysMode;

  /**
   * Applies object-level refinements after inherited and local fields have
   * been assembled.
   */
  configure?: (schema: DecoratedZodObject) => DecoratedZodObject;
}
