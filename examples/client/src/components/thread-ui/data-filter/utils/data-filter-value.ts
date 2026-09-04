import { cleanDataFilterValues } from "./clean-data-filter-values";
import type { DataFilterValue } from "../types";

export type DataFilterDraftFilter = Record<string, unknown>;

export const defaultDataFilterValue: DataFilterValue = {
  filter: {},
  query: "",
};

export const hydrateDataFilterValueFilter = (
  filter?: Record<string, unknown>,
): DataFilterDraftFilter => {
  return cleanDataFilterValues(filter ?? {});
};

export const serializeDataFilterValueFilter = (
  draftFilter: DataFilterDraftFilter,
): Record<string, unknown> => {
  return cleanDataFilterValues(draftFilter);
};

export const normalizeDataFilterValue = (
  value?: Partial<DataFilterValue>,
): DataFilterValue => {
  return {
    filter: hydrateDataFilterValueFilter(value?.filter),
    ...(value?.orderBy ? { orderBy: value.orderBy } : {}),
    query: value?.query ?? "",
  };
};
