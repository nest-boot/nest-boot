import { dataFilterDefaultCheckboxOperators } from "./data-filter-default-checkbox-operators";
import { dataFilterDefaultDatePickerOperators } from "./data-filter-default-date-picker-operators";
import { dataFilterDefaultInputOperators } from "./data-filter-default-input-operators";
import { dataFilterDefaultNumberInputOperators } from "./data-filter-default-number-input-operators";
import { dataFilterDefaultSelectOperators } from "./data-filter-default-select-operators";
import type { DataFilterItemProps, DataFilterOperator } from "../types";

export const getDataFilterOperators = (
  item: DataFilterItemProps,
): Array<DataFilterOperator> => {
  if (item.operators?.length) {
    return [...item.operators];
  }

  if (item.type === "number-input") {
    return [...dataFilterDefaultNumberInputOperators];
  }

  if (item.type === "date-picker") {
    return [...dataFilterDefaultDatePickerOperators];
  }

  if (item.type === "checkbox") {
    return [...dataFilterDefaultCheckboxOperators];
  }

  if (item.type === "select") {
    return [...dataFilterDefaultSelectOperators];
  }

  return [...dataFilterDefaultInputOperators];
};
