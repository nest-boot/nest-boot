import { t } from "@nest-boot/i18n";
import { registerDecorator, type ValidationOptions } from "class-validator";

export interface ArrayLengthOptions extends ValidationOptions {
  min?: number;
  max?: number;
}

function arrayLengthMessage(
  value: unknown,
  property: string,
  min?: number,
  max?: number,
): string {
  if (Array.isArray(value)) {
    if (typeof min !== "undefined" && typeof max !== "undefined") {
      return t("validation:arrayLength.between", {
        property: t(`property:${property}`),
        min,
        max,
      });
    }

    // 长度小于要求
    if (typeof min !== "undefined" && value.length < min) {
      return t("validation:arrayLength.gte", {
        property: t(`property:${property}`),
        compareProperty: `${min}`,
      });
    }

    // 长度大于要求
    if (typeof max !== "undefined" && value.length > max) {
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
  validationOptions: ArrayLengthOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    if (typeof propertyName === "string") {
      registerDecorator({
        name: "arrayLength",
        target: target.constructor,
        propertyName,
        options: validationOptions,
        validator: {
          validate(value: unknown) {
            if (Array.isArray(value)) {
              const { min, max } = validationOptions;

              if (
                (typeof min !== "undefined" && value.length < min) ||
                (typeof max !== "undefined" && value.length > max)
              ) {
                return false;
              }

              return true;
            }

            // 不是数组
            return false;
          },
          defaultMessage(args) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { value, property } = args!;
            const { min, max } = validationOptions;
            return arrayLengthMessage(value, property, min, max);
          },
        },
      });
    }
  };
}
