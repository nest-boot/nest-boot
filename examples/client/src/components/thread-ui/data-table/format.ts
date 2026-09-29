import type {
  DataTableColumnProps,
  DataTableDurationColumnProps,
} from "./types";

function textValue(value: unknown): string | null {
  if (value == null) return null;
  try {
    return String(value);
  } catch {
    // Data objects may have no primitive conversion (e.g. null prototypes).
    // An optional text fallback must not prevent a custom renderer from running.
    return null;
  }
}

export function getColumnAlign<TData extends object, TValue>(
  column: DataTableColumnProps<TData, TValue>,
) {
  return (
    column.align ??
    (column.type === "number" ||
    column.type === "currency" ||
    column.type === "percent" ||
    column.type === "duration"
      ? "right"
      : "left")
  );
}

interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

// Keep registry installs compatible with TS projects using pre-ES2025 Intl libs.
type DurationFormatConstructor = new (
  locale?: string,
  options?: { style?: DataTableDurationColumnProps<object>["style"] },
) => { format: (duration: DurationParts) => string };

const durationUnitMilliseconds = {
  milliseconds: 1,
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function parseDateValue(value: unknown) {
  if (value instanceof Date || typeof value === "number") {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime())
      ? { date, isDateOnly: false }
      : undefined;
  }
  if (typeof value !== "string") return undefined;
  const isDateOnly = dateOnlyPattern.test(value);
  if (!isDateOnly && !timestampPattern.test(value)) return undefined;

  // Validate the calendar part: Date otherwise rolls February 30 into March.
  const calendarDate = value.slice(0, 10);
  const parsedCalendarDate = new Date(`${calendarDate}T00:00:00Z`);
  if (
    !Number.isFinite(parsedCalendarDate.getTime()) ||
    parsedCalendarDate.toISOString().slice(0, 10) !== calendarDate
  ) {
    return undefined;
  }
  const date = isDateOnly ? parsedCalendarDate : new Date(value);
  return Number.isFinite(date.getTime()) ? { date, isDateOnly } : undefined;
}

/** Build Intl formatters once per column, rather than for every rendered cell. */
export function createColumnFormatter<TData extends object, TValue>(
  column: DataTableColumnProps<TData, TValue>,
  locale?: string,
  timeZone?: string,
): (value: unknown) => string | null {
  if (typeof column.render === "function") return textValue;
  switch (column.type) {
    case "number":
    case "currency":
    case "percent": {
      const formatter = new Intl.NumberFormat(column.locale ?? locale, {
        style: column.type === "number" ? "decimal" : column.type,
        ...(column.type === "currency" ? { currency: column.currency } : {}),
        ...(column.precision !== undefined
          ? {
              minimumFractionDigits: column.precision,
              maximumFractionDigits: column.precision,
            }
          : {}),
      });
      return (value) =>
        (typeof value === "number" && Number.isFinite(value)) ||
        typeof value === "bigint"
          ? formatter.format(value)
          : textValue(value);
    }
    case "duration": {
      const DurationFormat = (
        Intl as typeof Intl & { DurationFormat?: DurationFormatConstructor }
      ).DurationFormat;
      // Unsupported runtimes keep the raw value readable; consumers can load a polyfill.
      if (typeof DurationFormat !== "function") return textValue;
      const formatter = new DurationFormat(column.locale ?? locale, {
        style: column.style ?? "digital",
      });
      const multiplier = durationUnitMilliseconds[column.unit ?? "seconds"];
      return (value) => {
        if (typeof value !== "number" || !Number.isFinite(value))
          return textValue(value);
        const totalMilliseconds = Math.round(Math.abs(value) * multiplier);
        if (!Number.isSafeInteger(totalMilliseconds)) return textValue(value);
        const sign = value < 0 ? -1 : 1;
        // Duration hours do not wrap at 24; all fields must have the same sign.
        return formatter.format({
          hours: Math.floor(totalMilliseconds / 3_600_000) * sign,
          minutes: Math.floor((totalMilliseconds % 3_600_000) / 60_000) * sign,
          seconds: Math.floor((totalMilliseconds % 60_000) / 1000) * sign,
          milliseconds: (totalMilliseconds % 1000) * sign,
        });
      };
    }
    case "date":
    case "datetime":
    case "time": {
      const options: Intl.DateTimeFormatOptions = {
        ...(column.type !== "time"
          ? ({ year: "numeric", month: "2-digit", day: "2-digit" } as const)
          : {}),
        ...(column.type !== "date"
          ? { hour: "2-digit", minute: "2-digit", second: "2-digit" }
          : {}),
        ...(column.type === "time" ? { hour12: column.hour12 } : {}),
        timeZone: column.timeZone ?? timeZone,
      };
      const formatter = new Intl.DateTimeFormat(
        column.locale ?? locale,
        options,
      );
      // Only create this formatter when a calendar date actually needs it.
      let dateOnlyFormatter: Intl.DateTimeFormat | undefined;
      return (value) => {
        const parsed = parseDateValue(value);
        if (!parsed) return textValue(value);
        if (column.type === "date" && parsed.isDateOnly) {
          // Calendar dates have no time zone and must never move to another day.
          dateOnlyFormatter ??= new Intl.DateTimeFormat(
            column.locale ?? locale,
            {
              ...options,
              timeZone: "UTC",
            },
          );
          return dateOnlyFormatter.format(parsed.date);
        }
        return formatter.format(parsed.date);
      };
    }
    default:
      return textValue;
  }
}
