import type { z, ZodObject, ZodType } from "zod";

/** A class-like value whose instance shape is used as schema output. */
export interface ZodClass<T extends object = object> {
  /** Runtime class name used in declaration errors. */
  readonly name: string;
  /** The class prototype. */
  readonly prototype: T;
}

/** Extracts data properties from a DTO, excluding instance methods. */
export type ZodDtoData<T extends object> = {
  [Key in keyof T as Key extends string
    ? T[Key] extends (...args: never[]) => unknown
      ? never
      : Key
    : never]: T[Key];
};

/** The object schema assembled from a decorated DTO's data properties. */
export type DecoratedZodObject<T extends object = Record<string, unknown>> =
  ZodObject<{
    [Key in Extract<keyof ZodDtoData<T>, string>]-?: ZodType<
      ZodDtoData<T>[Key]
    >;
  }>;

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
