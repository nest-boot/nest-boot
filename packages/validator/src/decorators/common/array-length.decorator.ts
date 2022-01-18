import { getTranslation } from "@nest-boot/i18next";
import { registerDecorator, ValidationOptions } from "class-validator";

export interface ArrayLengthOptions extends ValidationOptions {
  min?: number;
  max?: number;
}

function arrayLengthMessage(
  value: unknown,
  property: string,
  min?: number,
  max?: number
): string {
  const t = getTranslation();
  if (Array.isArray(value)) {
    if (min && max) {
      return t("validation:arrayLength.between", {
        property: t(`property:${property}`),
        min,
        max,
      });
    }

    // 长度小于要求
    if (min && value.length < min) {
      return t("validation:arrayLength.gte", {
        property: t(`property:${property}`),
        compareProperty: `${min}`,
      });
    }

    // 长度大于要求
    if (max && value.length > max) {
      return t("validation:arrayLength.lte", {
        property: t(`property:${property}`),
        compareProperty: `${max}`,
      });
    }
  }

  // 不是数组
  return t("validation:is-array", {
    property: t(`property:${property}`),
  });
}

export function ArrayLength(
  validationOptions: ArrayLengthOptions
): PropertyDecorator {
  return (target: unknown, propertyName: string) => {
    registerDecorator({
      name: "arrayLength",
      target: target.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (Array.isArray(value)) {
            const { min, max } = validationOptions;

            if ((min && value.length < min) || (max && value.length > max)) {
              return false;
            }

            return true;
          }

          // 不是数组
          return false;
        },
        defaultMessage(args) {
          const { value, property } = args;
          const { min, max } = validationOptions;
          return arrayLengthMessage(value, property, min, max);
        },
      },
    });
  };
}
