import type { DataFilterEqualityOperator } from "./data-filter-equality-operator";
import type { DataFilterFullTextOperator } from "./data-filter-full-text-operator";

export type DataFilterInputOperator =
  | DataFilterEqualityOperator
  | DataFilterFullTextOperator;
