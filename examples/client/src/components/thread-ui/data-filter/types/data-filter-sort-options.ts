import type { DataFilterSortValue } from "./data-filter-sort-value";

export interface DataFilterSortOptions extends DataFilterSortValue {
  fieldLabel: string;
  directionLabel: string;
  disabled?: boolean;
}
