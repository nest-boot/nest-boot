import type { DataFilterSortValue } from "./data-filter-sort-value";

export interface DataFilterValue {
  query: string;
  orderBy?: DataFilterSortValue;
  filter: Record<string, unknown>;
}
