import { ValidateBy, type ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

/** Validation name constant for the IsDate validator. */
export const IS_DATE = "isDate";

/**
 * Checks if a given value is a date.
 */
export function isDate(value: unknown): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Checks if a value is a date.
 */
export function IsDate(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_DATE,
      validator: {
        validate: (value): boolean => isDate(value),
        defaultMessage: buildI18nMessage(() => "is-date"),
      },
    },
    validationOptions,
  );
}
