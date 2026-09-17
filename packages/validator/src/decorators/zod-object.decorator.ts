import { registerZodObject } from "../schema/metadata.js";
import type { ZodClass, ZodObjectOptions } from "../types.js";

/**
 * Marks a class as a Zod object and optionally configures its object schema.
 *
 * @remarks
 * This decorator is optional when a class already has at least one
 * {@link ZodField}. It is useful for empty DTOs, unknown-key handling, and
 * object-level refinements.
 *
 * @param options - Object-level schema options
 * @returns A class decorator
 */
export function ZodObject(options: ZodObjectOptions = {}): ClassDecorator {
  return (target) => {
    registerZodObject(target as ZodClass, options);
  };
}
