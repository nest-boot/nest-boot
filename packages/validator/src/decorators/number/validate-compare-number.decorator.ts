import { t } from "@nest-boot/i18n";
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from "class-validator";

export enum Comparator {
  EQ = "EQ",
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",
}

export function ValidateCompareNumber(
  comparator: Comparator,
  compareProperty: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    if (typeof propertyName === "string") {
      registerDecorator({
        name: "isGreaterThanOrEqual",
        target: target.constructor,
        propertyName,
        constraints: [comparator, compareProperty],
        options: validationOptions,
        validator: {
          validate(value: unknown, args: ValidationArguments) {
            if (typeof args === "undefined") {
              return false;
            }

            const [innerComparator, innerCompareProperty] =
              args.constraints as [Comparator, string];

            const compareValue = (args.object as any)[innerCompareProperty];

            if (compareValue === undefined || compareValue === null) {
              return true;
            }

            switch (innerComparator) {
              case Comparator.EQ:
                return Number(value) === Number(compareValue);
              case Comparator.GT:
                return Number(value) > Number(compareValue);
              case Comparator.GTE:
                return Number(value) >= Number(compareValue);
              case Comparator.LT:
                return Number(value) < Number(compareValue);
              case Comparator.LTE:
                return Number(value) <= Number(compareValue);
              default:
                return false;
            }
          },
          defaultMessage(args) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { property, constraints } = args!;
            const [innerComparator, innerCompareProperty] = constraints as [
              string,
              string,
            ];

            return t(`validation:is-${innerComparator.toLowerCase()}`, {
              ...args,
              property: t(`property:${property}`),
              compareProperty: t(`property:${innerCompareProperty}`),
            });
          },
        },
      });
    }
  };
}
