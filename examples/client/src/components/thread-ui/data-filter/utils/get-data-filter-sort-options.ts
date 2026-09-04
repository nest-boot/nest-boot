import type { DataFilterSortOptions, DataFilterSortValue } from "../types";

export type DataFilterSortFieldChoice = {
  key: string;
  option: DataFilterSortOptions;
};

export const getDataFilterSortOptionByKey = (
  options: Array<DataFilterSortOptions>,
  key: string,
): DataFilterSortOptions | null => {
  const index = Number(key);

  return Number.isInteger(index) && options[index] ? options[index] : null;
};

export const getDataFilterSortFieldChoices = (
  options: Array<DataFilterSortOptions>,
  selected?: DataFilterSortValue,
): Array<DataFilterSortFieldChoice> => {
  const seenFields = new Set<string>();
  const choices: Array<DataFilterSortFieldChoice> = [];

  options.forEach((option, index) => {
    if (seenFields.has(option.field)) {
      return;
    }

    seenFields.add(option.field);

    const selectedDirectionOptionIndex = options.findIndex((candidate) => {
      return (
        candidate.field === option.field &&
        candidate.direction === selected?.direction
      );
    });

    const optionIndex =
      selectedDirectionOptionIndex >= 0 ? selectedDirectionOptionIndex : index;

    choices.push({
      key: String(optionIndex),
      option: options[optionIndex],
    });
  });

  return choices;
};
