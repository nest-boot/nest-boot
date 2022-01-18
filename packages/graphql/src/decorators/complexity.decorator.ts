import { Directive } from "@nestjs/graphql";

export function Complexity<T>(
  value: number,
  multipliers?: (keyof T & string)[]
): MethodDecorator & PropertyDecorator & ClassDecorator {
  return Directive(
    `@complexity(value: ${value}${
      multipliers ? `, multipliers: ${JSON.stringify(multipliers)})` : ")"
    }`
  );
}
