import { ValidationOptions } from "class-validator";

import {
  Comparator,
  ValidateCompareNumber,
} from "./validate-compare-number.decorator";

export function IsGreaterThanOrEqual(
  field: string,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateCompareNumber(Comparator.GTE, field, validationOptions);
}
