import { t } from "@nest-boot/i18n";
import { registerDecorator, type ValidationOptions } from "class-validator";

/** Options for the {@link ArrayLength} decorator. */
export interface ArrayLengthOptions extends ValidationOptions {
  /** Minimum array length. */
  min?: number;
  /** Maximum array length. */
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

    // Length is less than required
    if (typeof min !== "undefined" && value.length < min) {
      return t("validation:arrayLength.gte", {
        property: t(`property:${property}`),
        compareProperty: String(min),
      });
    }

    // Length exceeds required
    if (typeof max !== "undefined" && value.length > max) {
      return t("validation:arrayLength.lte", {
        property: t(`property:${property}`),
        compareProperty: String(max),
      });
    }
  }

  // Not an array
  return t("validation:is-array", {
    property: t(`property:${property}`),
  });
}

/**
 * Validates that the array length falls within the specified range.
 * @param validationOptions - Array length constraints and validation options
 * @returns Property decorator
 */
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

            // Not an array
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
