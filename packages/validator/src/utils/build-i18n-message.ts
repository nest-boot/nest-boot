import { t } from "@nest-boot/i18n";
import { type ValidationArguments } from "class-validator";

export function buildI18nMessage(
  callback: (args: ValidationArguments) => string,
) {
  return (args: ValidationArguments): string => {
    return t(`validation:${callback(args)}`, {
      ...args,
      ...args.constraints?.reduce(
        (constraints, value, index) => ({
          ...constraints,
          [`constraint${String(index)}`]: value,
        }),
        {},
      ),
      property: t(`property:${args.property}`),
    });
  };
}
