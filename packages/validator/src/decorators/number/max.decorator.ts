import { ValidateBy, type ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

/**
 * Validates that the property value is less than or equal to the specified maximum.
 * @param maxValue - The maximum allowed value
 * @param validationOptions - Optional class-validator validation options
 * @returns Property decorator
 */
export function Max(
  maxValue: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: "max",
      constraints: [maxValue],
      validator: {
        validate: (value, args): boolean =>
          typeof args !== "undefined" &&
          Number(value) <= Number(args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "max"),
      },
    },
    validationOptions,
  );
}
