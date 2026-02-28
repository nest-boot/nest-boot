import { Directive } from "@nest-boot/graphql";

/** Options for the `@Complexity` decorator. */
export interface ComplexityOptions {
  /** Base complexity value for the field or resolver. */
  value?: number;
  /** Argument names whose values multiply the complexity (e.g. `["first"]`). */
  multipliers?: string[];
}

/**
 * Decorator that applies a `@complexity` directive to a GraphQL field or type.
 * @param options - Complexity configuration options
 * @returns A combined method, property, and class decorator
 */
export function Complexity(
  options: ComplexityOptions,
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return Directive(
    `@complexity(value: ${String(options.value ?? 1)}, multipliers: ${JSON.stringify(
      options.multipliers ?? [],
    )})`,
  );
}
