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
  "$between",
]);

function getFilterConditions(value: any): Array<[string, any]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).filter(([operator]) =>
    DATA_FILTER_OPERATORS.has(operator),
  );
}

export function formatFilterValues(
  values: Record<string, any>,
  formatValue?: (field: string, value: any, operator?: string) => any,
): Record<string, any> {
  const filter: Record<string, any> = {};

  for (const [key, value] of Object.entries(values)) {
    const conditions = getFilterConditions(value);
    filter[key] = conditions.length
      ? Object.assign(
          {},
          ...conditions.map(
            ([operator, value]) =>
              formatValue?.(key, value, operator) ?? { [operator]: value },
          ),
        )
      : (formatValue?.(key, value) ?? value);
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

  if (value !== null && (field === "created_at" || field === "createdAt")) {
    if (operator === "$between") {
      return {
        $between: [value[0], dayjs(value[1]).endOf("day").toISOString()],
      };
    }

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
