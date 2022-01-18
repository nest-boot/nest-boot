import { ValidateBy, ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

export function Max(
  maxValue: number,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "max",
      constraints: [maxValue],
      validator: {
        validate: (value, args): boolean =>
          Number(value) <= Number(args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "max"),
      },
    },
    validationOptions
  );
}
