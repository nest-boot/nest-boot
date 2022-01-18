import { ValidateBy, ValidationOptions } from "class-validator";

import { buildI18nMessage } from "../../utils";

export function Min(
  minValue: number,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "min",
      constraints: [minValue],
      validator: {
        validate: (value, args): boolean =>
          Number(value) >= Number(args.constraints[0]),
        defaultMessage: buildI18nMessage(() => "min"),
      },
    },
    validationOptions
  );
}
