import { createDataFilterCondition } from "./create-data-filter-condition";
import { getDataFilterCondition } from "./get-data-filter-condition";
import { isEmptyDataFilterValue } from "./is-empty-data-filter-value";

const normalizeDataFilterValue = (value: unknown) => {
  const condition = getDataFilterCondition(value);

  if (condition.operator === "$between") {
    return createDataFilterCondition(condition.operator, condition.value);
  }

  return value;
};

export const cleanDataFilterValues = (
  values: Record<string, unknown>,
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => !isEmptyDataFilterValue(value))
      .map(([field, value]) => [field, normalizeDataFilterValue(value)]),
  );
};
