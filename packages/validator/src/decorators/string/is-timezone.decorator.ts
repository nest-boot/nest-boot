import { ValidateBy, type ValidationOptions } from "class-validator";
import moment from "moment-timezone";

import { buildI18nMessage } from "../../utils";

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
