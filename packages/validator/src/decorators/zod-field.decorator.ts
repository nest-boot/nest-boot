import { registerZodField } from "../schema/metadata.js";
import type { ZodFieldDefinition } from "../types.js";

/**
 * Associates a Zod schema with a class property.
 *
 * @example
 * ```ts
 * class UserDto {
 *   @ZodField(z.email())
 *   email!: string;
 *
 *   @ZodField((z) => z.string().min(8))
 *   password!: string;
 * }
 * ```
 *
 * @param definition - A schema or a factory that receives the Zod namespace
 * @returns A property decorator
 */
export function ZodField(definition: ZodFieldDefinition): PropertyDecorator {
  const factory =
    typeof definition === "function" ? definition : () => definition;

  return (target, propertyKey) => {
    if (typeof propertyKey !== "string") {
      throw new TypeError("ZodField does not support symbol properties");
    }

    registerZodField(target, propertyKey, factory);
  };
}
