import dayjs from "dayjs";

const DATA_FILTER_OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$fulltext",
  "$in",
  "$nin",
]);

function getFilterCondition(value: any): { operator?: string; value: any } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value };
  }

  const condition = Object.entries(value).find(([operator]) =>
    DATA_FILTER_OPERATORS.has(operator),
  );

  return condition
    ? {
        operator: condition[0],
        value: condition[1],
      }
    : { value };
}

export function formatFilterValues(
  values: Record<string, any>,
  formatValue?: (field: string, value: any, operator?: string) => any,
): Record<string, any> {
  const filter: Record<string, any> = {};

  for (const [key, value] of Object.entries(values)) {
    const condition = getFilterCondition(value);
    filter[key] =
      formatValue?.(key, condition.value, condition.operator) ??
      (condition.operator
        ? { [condition.operator]: condition.value }
        : condition.value);
  }

  return filter;
}

export function formatConnectionFilterValue(
  field: string,
  value: any,
  operator?: string,
): any {
  if (
    !operator &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  ) {
    return value;
  }

  if (field === "created_at" || field === "createdAt") {
    const dateOperator = operator === "$lte" ? "$lte" : (operator ?? "$gte");

    return {
      [dateOperator]:
        dateOperator === "$lte"
          ? dayjs(value).endOf("day").toISOString()
          : value,
    };
  }

  return operator ? { [operator]: value } : value;
}
