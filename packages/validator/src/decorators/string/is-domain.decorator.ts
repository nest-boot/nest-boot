import { ValidateBy, type ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

/**
 * Validates that the string value is a valid domain name.
 * @param validationOptions - Optional class-validator validation options
 * @returns Property decorator
 */
export function IsDomain(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: "IsDomain",
      validator: {
        validate: (value): boolean =>
          typeof value === "string" &&
          /^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/.test(
            value,
          ),
        defaultMessage: buildI18nMessage(() => "is-domain"),
      },
    },
    validationOptions,
  );
}
