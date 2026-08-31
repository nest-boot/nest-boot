import { ValidateBy, type ValidationOptions } from "class-validator";
import { type IsNumericOptions } from "validator";
import isNumericModule from "validator/lib/isNumeric.js";

import { buildI18nMessage } from "../../utils/index.js";

const isNumericValidator = isNumericModule as unknown as (
  str: string,
  options?: IsNumericOptions,
) => boolean;

/** Validation name constant for the IsNumberString validator. */
export const IS_NUMBER_STRING = "isNumberString";

/**
 * Checks if the string is numeric.
 * If given value is not a string, then it returns false.
 */
export function isNumberString(
  value: unknown,
  options?: IsNumericOptions,
): boolean {
  return typeof value === "string" && isNumericValidator(value, options);
}

/**
 * Checks if the string is numeric.
 * If given value is not a string, then it returns false.
 */
export function IsNumberString(
  options?: IsNumericOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_NUMBER_STRING,
      constraints: [options],
      validator: {
        validate: (value, args): boolean =>
          typeof args !== "undefined" &&
          isNumberString(value, args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "is-number-string"),
      },
    },
    validationOptions,
  );
}
