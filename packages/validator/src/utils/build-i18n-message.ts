import { t } from "@nest-boot/i18n";
import { type ValidationArguments } from "class-validator";

/**
 * Creates an i18n-aware validation message factory.
 *
 * @remarks
 * Wraps a callback that returns a translation key, automatically
 * providing constraint values and property translation to the message.
 *
 * @param callback - Function that receives validation args and returns the translation key suffix
 * @returns A function usable as the `defaultMessage` in class-validator decorators
 */
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
