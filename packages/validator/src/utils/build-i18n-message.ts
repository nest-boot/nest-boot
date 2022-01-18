import { getTranslation } from "@nest-boot/i18next";
import { ValidationArguments } from "class-validator";

export function buildI18nMessage(
  callback: (args?: ValidationArguments) => string
) {
  return (args?: ValidationArguments): string => {
    const t = getTranslation();

    return t(`validation:${callback(args)}`, {
      ...args,
      ...args.constraints?.reduce(
        (constraints, value, index) => ({
          ...constraints,
          [`constraint${index}`]: value,
        }),
        {}
      ),
      property: t(`property:${args.property}`),
    });
  };
}
