import type { DataFilterBetweenOperator } from "./data-filter-between-operator";
import type { DataFilterComparisonOperator } from "./data-filter-comparison-operator";
import type { DataFilterEqualityOperator } from "./data-filter-equality-operator";
import type { DataFilterFullTextOperator } from "./data-filter-full-text-operator";
import type { DataFilterInOperator } from "./data-filter-in-operator";
import type { DataFilterNotInOperator } from "./data-filter-not-in-operator";

export type DataFilterOperator =
  | DataFilterEqualityOperator
  | DataFilterComparisonOperator
  | DataFilterBetweenOperator
  | DataFilterFullTextOperator
  | DataFilterInOperator
  | DataFilterNotInOperator;
