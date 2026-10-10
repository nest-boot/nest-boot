import { getDataFilterBetweenValue } from "./get-data-filter-between-value";
import { getDataFilterCondition } from "./get-data-filter-condition";
import { isEmpty } from "./is-empty";

export const isEmptyDataFilterValue = (value: unknown): boolean => {
  const condition = getDataFilterCondition(value);

  if (condition.operator === "$between") {
    const range = getDataFilterBetweenValue(condition.value);

    return (
      range.some((value) => isEmpty(value)) ||
      range.some((value) => value === null)
    );
  }

  return isEmpty(condition.value);
};
