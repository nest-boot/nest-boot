import { type ValidationOptions } from "class-validator";

import {
  Comparator,
  ValidateCompareNumber,
} from "./validate-compare-number.decorator";

/**
 * Validates that the property value is greater than or equal to the given field's value.
 * @param field - The name of the property to compare against
 * @param validationOptions - Optional class-validator validation options
 * @returns Property decorator
 */
export function IsGreaterThanOrEqual(
  field: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateCompareNumber(Comparator.GTE, field, validationOptions);
}
