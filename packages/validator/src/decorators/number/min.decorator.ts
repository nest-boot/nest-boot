import { ValidateBy, type ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

/**
 * Validates that the property value is greater than or equal to the specified minimum.
 * @param minValue - The minimum allowed value
 * @param validationOptions - Optional class-validator validation options
 * @returns Property decorator
 */
export function Min(
  minValue: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: "min",
      constraints: [minValue],
      validator: {
        validate: (value, args): boolean =>
          typeof args !== "undefined" &&
          Number(value) >= Number(args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "min"),
      },
    },
    validationOptions,
  );
}
