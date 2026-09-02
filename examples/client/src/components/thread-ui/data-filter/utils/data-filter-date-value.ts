import dayjs from "dayjs";

import { getDataFilterBetweenValue } from "./get-data-filter-between-value";
import type { DataFilterBetweenValue } from "../types";

export const getDataFilterDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = dayjs(value);

  return date.isValid() ? date.toDate() : undefined;
};

export const formatDataFilterDateValue = (value: unknown): unknown => {
  const date =
    value instanceof Date || typeof value === "string"
      ? dayjs(value)
      : undefined;

  return date?.isValid() ? date.format("YYYY-MM-DD") : value;
};

export const getDataFilterDateRange = (
  value: unknown,
): DataFilterBetweenValue<Date> => {
  const [from, to] = getDataFilterBetweenValue(value);

  return [getDataFilterDate(from), getDataFilterDate(to)];
};

export const getDataFilterDateRangeValue = (dateRange?: {
  from?: Date;
  to?: Date;
}): DataFilterBetweenValue<string> => {
  return [dateRange?.from?.toISOString(), dateRange?.to?.toISOString()];
};

export const getDataFilterDateDisabled = ({
  min,
  max,
}: {
  min?: Date | string;
  max?: Date | string;
}) => {
  const minDate = getDataFilterDate(min);
  const maxDate = getDataFilterDate(max);

  return (date: Date) => {
    return (
      (typeof minDate !== "undefined" &&
        dayjs(date).isBefore(minDate, "day")) ||
      (typeof maxDate !== "undefined" && dayjs(date).isAfter(maxDate, "day"))
    );
  };
};
