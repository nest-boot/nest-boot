type FilterObject = Record<string, unknown>;

function isObject(value: unknown): value is FilterObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayStart(value: string, timezoneOffset: number): Date {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) throw new RangeError("Expected a YYYY-MM-DD date");
  const year = Number(parts[1]);
  const month = Number(parts[2]) - 1;
  const day = Number(parts[3]);
  const date = new Date(0);
  // setUTCFullYear preserves years 0–99, unlike the multi-argument constructor.
  date.setUTCFullYear(year, month, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid calendar date");
  }
  // getTimezoneOffset() is UTC minus local time, in minutes.
  date.setUTCMinutes(timezoneOffset);
  return date;
}

function nextDayStart(value: string, timezoneOffset: number): string {
  const date = dayStart(value, timezoneOffset);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function combine(clauses: FilterObject[]): FilterObject {
  const keys = clauses.flatMap((clause) => Object.keys(clause));
  return new Set(keys).size === keys.length
    ? Object.assign({}, ...clauses)
    : { $and: clauses };
}

function dateCondition(
  field: string,
  operator: string,
  value: unknown,
  timezoneOffset: number,
): FilterObject {
  if (
    (operator === "$in" || operator === "$nin") &&
    Array.isArray(value) &&
    value.some(isDateOnly)
  ) {
    const alternatives = value.map((item) =>
      dateCondition(field, "$eq", item, timezoneOffset),
    );
    const included = { $or: alternatives };
    return operator === "$nin" ? { $not: included } : included;
  }
  if (!isDateOnly(value)) return { [field]: { [operator]: value } };

  const start = dayStart(value, timezoneOffset).toISOString();
  switch (operator) {
    case "$eq":
      return {
        [field]: { $gte: start, $lt: nextDayStart(value, timezoneOffset) },
      };
    case "$ne":
      return {
        $not: {
          [field]: { $gte: start, $lt: nextDayStart(value, timezoneOffset) },
        },
      };
    case "$gte":
    case "$lt":
      return { [field]: { [operator]: start } };
    case "$gt":
      return { [field]: { $gte: nextDayStart(value, timezoneOffset) } };
    case "$lte":
      return { [field]: { $lt: nextDayStart(value, timezoneOffset) } };
    default:
      return { [field]: { [operator]: value } };
  }
}

/** Expand validated date-only filters into half-open day ranges.
 * Run after schema validation and field replacements; timestamps stay exact.
 */
export function normalizeDateFilter(
  value: unknown,
  dateFields: ReadonlySet<string>,
  timezoneOffset: number,
  path = "",
): unknown {
  if (!isObject(value)) return value;
  const clauses = Object.entries(value).map(
    ([field, condition]): FilterObject => {
      if ((field === "$and" || field === "$or") && Array.isArray(condition)) {
        return {
          [field]: condition.map((item) =>
            normalizeDateFilter(item, dateFields, timezoneOffset, path),
          ),
        };
      }
      if (field === "$not") {
        return {
          [field]: normalizeDateFilter(
            condition,
            dateFields,
            timezoneOffset,
            path,
          ),
        };
      }
      const fieldPath = path ? `${path}.${field}` : field;
      if (!dateFields.has(fieldPath)) {
        return {
          [field]: normalizeDateFilter(
            condition,
            dateFields,
            timezoneOffset,
            fieldPath,
          ),
        };
      }
      if (isDateOnly(condition))
        return dateCondition(field, "$eq", condition, timezoneOffset);
      if (Array.isArray(condition))
        return dateCondition(field, "$in", condition, timezoneOffset);
      if (!isObject(condition)) return { [field]: condition };
      if (
        !Object.values(condition).some(
          (operand) =>
            isDateOnly(operand) ||
            (Array.isArray(operand) && operand.some(isDateOnly)),
        )
      ) {
        return { [field]: condition };
      }
      // The schema has already expanded $between to $gte / $lte.
      return combine(
        Object.entries(condition).map(([operator, operand]) =>
          dateCondition(field, operator, operand, timezoneOffset),
        ),
      );
    },
  );
  return combine(clauses);
}
