import { Directive } from "@nestjs/graphql";

export interface ComplexityOptions {
  value?: number;
  multipliers?: string[];
}

export function Complexity(
  options: ComplexityOptions
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return Directive(
    `@complexity(value: ${options.value ?? 0}, multipliers: ${JSON.stringify(
      options.multipliers ?? []
    )})`
  );
}
