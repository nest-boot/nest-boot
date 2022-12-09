import { Directive } from "@nestjs/graphql";

export function Complexity<T>(
  value: number,
  multipliers?: Array<keyof T & string>
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return Directive(
    `@complexity(value: ${value}${
      typeof multipliers !== "undefined"
        ? `, multipliers: ${JSON.stringify(multipliers)})`
        : ")"
    }`
  );
}
