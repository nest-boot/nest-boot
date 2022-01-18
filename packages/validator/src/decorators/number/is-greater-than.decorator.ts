import { ValidationOptions } from "class-validator";

import {
  Comparator,
  ValidateCompareNumber,
} from "./validate-compare-number.decorator";

export function IsGreaterThan(
  field: string,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateCompareNumber(Comparator.GT, field, validationOptions);
}
