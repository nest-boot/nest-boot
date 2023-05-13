import { type ValidationOptions } from "class-validator";

import {
  Comparator,
  ValidateCompareNumber,
} from "./validate-compare-number.decorator";

export function IsLessThanOrEqual(
  field: string,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateCompareNumber(Comparator.LTE, field, validationOptions);
}
