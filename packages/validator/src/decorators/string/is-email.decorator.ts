import { ValidateBy, type ValidationOptions } from "class-validator";
import type ValidatorJS from "validator";
import isEmailValidator from "validator/lib/isEmail";

import { buildI18nMessage } from "../../utils";

export const IS_EMAIL = "isEmail";

/**
 * Checks if the string is an email.
 * If given value is not a string, then it returns false.
 */
export function isEmail(
  value: unknown,
  options?: ValidatorJS.IsEmailOptions
): boolean {
  return typeof value === "string" && isEmailValidator(value, options);
}

/**
 * Checks if the string is an email.
 * If given value is not a string, then it returns false.
 */
export function IsEmail(
  options?: ValidatorJS.IsEmailOptions,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_EMAIL,
      constraints: [options],
      validator: {
        validate: (value, args): boolean =>
          typeof args !== "undefined" && isEmail(value, args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "is-email"),
      },
    },
    validationOptions
  );
}
