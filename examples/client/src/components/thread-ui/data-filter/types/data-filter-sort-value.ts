import type { DataFilterSortDirection } from "./data-filter-sort-direction";

export interface DataFilterSortValue {
  field: string;
  direction: DataFilterSortDirection;
}
