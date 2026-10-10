import type { DataFilterBetweenOperator } from "./data-filter-between-operator";
import type { DataFilterComparisonOperator } from "./data-filter-comparison-operator";
import type { DataFilterEqualityOperator } from "./data-filter-equality-operator";

export type DataFilterNumberInputOperator =
  | DataFilterEqualityOperator
  | DataFilterComparisonOperator
  | DataFilterBetweenOperator;
