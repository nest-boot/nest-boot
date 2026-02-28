import { ValidateBy, type ValidationOptions } from "class-validator";
import moment from "moment-timezone";

import { buildI18nMessage } from "../../utils";

/**
 * Validates that the string value is a valid IANA timezone identifier.
 * @param validationOptions - Optional class-validator validation options
 * @returns Property decorator
 */
export function IsTimezone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isTimezone",
      validator: {
        validate: (value): boolean =>
          typeof value === "string" && !(moment.tz.zone(value) == null),
        defaultMessage: buildI18nMessage(() => "is-timezone"),
      },
    },
    validationOptions,
  );
}
