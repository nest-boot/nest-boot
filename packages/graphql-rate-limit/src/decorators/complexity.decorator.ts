import { Directive } from "@nest-boot/graphql";

export interface ComplexityOptions {
  value?: number;
  multipliers?: string[];
}

export function Complexity(
  options: ComplexityOptions,
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return Directive(
    `@complexity(value: ${String(options.value ?? 1)}, multipliers: ${JSON.stringify(
      options.multipliers ?? [],
    )})`,
  );
}
