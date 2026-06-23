import { createRequire } from "node:module";

import { ValidateBy, type ValidationOptions } from "class-validator";
import { type IsEmailOptions } from "validator";

import { buildI18nMessage } from "../../utils/index.js";

const require = createRequire(import.meta.url);
const isEmailValidator = require("validator/lib/isEmail.js") as (
  str: string,
  options?: IsEmailOptions,
) => boolean;

/** Validation name constant for the IsEmail validator. */
export const IS_EMAIL = "isEmail";

/**
 * Checks if the string is an email.
 * If given value is not a string, then it returns false.
 */
export function isEmail(value: unknown, options?: IsEmailOptions): boolean {
  return typeof value === "string" && isEmailValidator(value, options);
}

/**
 * Checks if the string is an email.
 * If given value is not a string, then it returns false.
 */
export function IsEmail(
  options?: IsEmailOptions,
  validationOptions?: ValidationOptions,
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
    validationOptions,
  );
}
