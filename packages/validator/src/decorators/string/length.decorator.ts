import { ValidateBy, type ValidationOptions } from "class-validator";
import isLengthValidator from "validator/lib/isLength";

import { buildI18nMessage } from "../../utils/build-i18n-message";

/** Validation name constant for the Length validator. */
export const IS_LENGTH = "isLength";

/**
 * Checks if the string's length falls in a range. Note: this function takes into account surrogate pairs.
 * If given value is not a string, then it returns false.
 */
export function length(value: unknown, min: number, max?: number): boolean {
  return typeof value === "string" && isLengthValidator(value, { min, max });
}

/**
 * Checks if the string's length falls in a range. Note: this function takes into account surrogate pairs.
 * If given value is not a string, then it returns false.
 */
export function Length(
  min: number,
  max?: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_LENGTH,
      constraints: [min, max],
      validator: {
        validate: (value, args): boolean =>
          typeof args !== "undefined" &&
          length(value, args.constraints[0], args.constraints[1]),
        defaultMessage: buildI18nMessage((args) => {
          if (typeof args !== "undefined") {
            const isMinLength =
              args.constraints[0] !== null && args.constraints[0] !== undefined;
            const isMaxLength =
              args.constraints[1] !== null && args.constraints[1] !== undefined;

            if (
              isMinLength &&
              !isMaxLength &&
              args.value.length < args.constraints[0]
            ) {
              return "length.gte";
            }
          }

          return "length.between";
        }),
      },
    },
    validationOptions,
  );
}
