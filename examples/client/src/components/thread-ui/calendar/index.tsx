"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentProps } from "react";
import type { Locale as DayPickerLocale } from "react-day-picker";
import type { TFunction } from "i18next";

import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";

type ShadcnCalendarProps = ComponentProps<typeof ShadcnCalendar>;
type WithoutCalendarLocale<T> = T extends unknown ? Omit<T, "locale"> : never;

export type CalendarProps = WithoutCalendarLocale<ShadcnCalendarProps>;

type LocalizeWidth = "narrow" | "short" | "abbreviated" | "wide" | "any";
type WidthValues = Partial<Record<LocalizeWidth, Array<string>>>;
type DayPeriodValues = Partial<Record<LocalizeWidth, Record<string, string>>>;
type DayPickerLocaleOptions = NonNullable<DayPickerLocale["options"]>;

const getRecordResource = (value: unknown) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const getWidthResource = (value: unknown): WidthValues => {
  const record = getRecordResource(value);

  return Object.fromEntries(
    Object.entries(record).map(([width, value]) => [
      width,
      Array.isArray(value) ? value.map(String) : [],
    ]),
  ) as WidthValues;
};

const getDayPeriodResource = (value: unknown): DayPeriodValues => {
  const record = getRecordResource(value);

  return Object.fromEntries(
    Object.entries(record).map(([width, value]) => [
      width,
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.entries(value).map(([period, label]) => [
              period,
              String(label),
            ]),
          )
        : {},
    ]),
  ) as DayPeriodValues;
};

const getWidth = (width?: LocalizeWidth) => {
  return width && width !== "any" ? width : "wide";
};

const getWidthValue = (
  values: WidthValues,
  index: number,
  width?: LocalizeWidth,
) => {
  const preferredWidth = getWidth(width);
  const widthValues =
    values[preferredWidth] ??
    (preferredWidth === "short" ? values.abbreviated : undefined) ??
    values.wide ??
    values.abbreviated ??
    values.short ??
    values.narrow ??
    [];

  return widthValues[index] ?? String(index);
};

const formatDateLabel = (date: Date, localeCode: string) => {
  return new Intl.DateTimeFormat(localeCode, {
    dateStyle: "full",
  }).format(date);
};

const buildDayPickerLocale = (
  t: TFunction,
  language?: string,
): Partial<DayPickerLocale> => {
  const localeCode = t("calendar.code", {
    defaultValue: language ?? "en-US",
  });
  const eras = getWidthResource(t("calendar.eras", { returnObjects: true }));
  const quarters = getWidthResource(
    t("calendar.quarters", { returnObjects: true }),
  );
  const months = getWidthResource(
    t("calendar.months", { returnObjects: true }),
  );
  const weekdays = getWidthResource(
    t("calendar.weekdays", { returnObjects: true }),
  );
  const dayPeriods = getDayPeriodResource(
    t("calendar.dayPeriods", { returnObjects: true }),
  );
  const formattingDayPeriods = getDayPeriodResource(
    t("calendar.formattingDayPeriods", { returnObjects: true }),
  );
  const weekStartsOn = Number(
    t("calendar.options.weekStartsOn", { defaultValue: 0 }),
  ) as DayPickerLocaleOptions["weekStartsOn"];
  const firstWeekContainsDate = Number(
    t("calendar.options.firstWeekContainsDate", { defaultValue: 1 }),
  ) as DayPickerLocaleOptions["firstWeekContainsDate"];
  const wideMonths = months.wide ?? [];
  const wideWeekdays = weekdays.wide ?? [];

  return {
    code: localeCode,
    labels: {
      labelDayButton: (date, modifiers) => {
        let label = formatDateLabel(date, localeCode);

        if (modifiers.today) {
          label = t("calendar.labels.today", { label });
        }

        if (modifiers.selected) {
          label = t("calendar.labels.selected", { label });
        }

        return label;
      },
      labelGrid: (date) =>
        t("calendar.labels.grid", {
          month: wideMonths[date.getMonth()] ?? String(date.getMonth() + 1),
          year: date.getFullYear(),
        }),
      labelGridcell: (date, modifiers) => {
        let label = formatDateLabel(date, localeCode);

        if (modifiers?.today) {
          label = t("calendar.labels.today", { label });
        }

        return label;
      },
      labelMonthDropdown: t("calendar.labels.monthDropdown"),
      labelNav: t("calendar.labels.nav"),
      labelNext: t("calendar.labels.next"),
      labelPrevious: t("calendar.labels.previous"),
      labelWeekday: (date) =>
        wideWeekdays[date.getDay()] ?? String(date.getDay()),
      labelWeekNumber: (weekNumber) =>
        t("calendar.labels.weekNumber", { weekNumber }),
      labelWeekNumberHeader: t("calendar.labels.weekNumberHeader"),
      labelYearDropdown: t("calendar.labels.yearDropdown"),
    },
    localize: {
      ordinalNumber: (value, options) =>
        t("calendar.ordinalNumber", {
          number: Number(value),
          unit: options?.unit,
        }),
      era: (value, options) =>
        getWidthValue(eras, Number(value), options?.width),
      quarter: (value, options) =>
        getWidthValue(quarters, Number(value) - 1, options?.width),
      month: (value, options) =>
        getWidthValue(months, Number(value), options?.width),
      day: (value, options) =>
        getWidthValue(weekdays, Number(value), options?.width),
      dayPeriod: (value, options) => {
        const values =
          options?.context === "formatting" ? formattingDayPeriods : dayPeriods;
        const widthValues =
          values[getWidth(options?.width)] ??
          values.wide ??
          values.abbreviated ??
          values.narrow ??
          {};

        return widthValues[value] ?? String(value);
      },
    },
    options: {
      weekStartsOn,
      firstWeekContainsDate,
    },
  };
};

export const Calendar = (props: CalendarProps) => {
  const { i18n, t } = useTranslation("thread-ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const calendarLocale = useMemo(() => {
    return buildDayPickerLocale(t, language);
  }, [language, t]);
  const calendarProps = {
    ...props,
    locale: calendarLocale,
  } as ShadcnCalendarProps;

  return <ShadcnCalendar {...calendarProps} />;
};
