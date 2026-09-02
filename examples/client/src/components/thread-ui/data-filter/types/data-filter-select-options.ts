import type { DataFilterSelectOption } from "./data-filter-select-option";

export type DataFilterSelectOptions =
  | Array<DataFilterSelectOption>
  | ((query: string) => Promise<Array<DataFilterSelectOption>>);

export type DataFilterResolveSelectedOptions = (
  values: Array<string>,
) => Promise<Array<DataFilterSelectOption>>;
