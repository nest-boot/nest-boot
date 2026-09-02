import type { DataFilterInOperator } from "./data-filter-in-operator";
import type { DataFilterNotInOperator } from "./data-filter-not-in-operator";

export type DataFilterSelectOperator =
  | DataFilterInOperator
  | DataFilterNotInOperator;
