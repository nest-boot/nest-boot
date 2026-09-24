"use client";

import { DataFilterProvider } from "./components/data-filter-context";
import { DataFilterTagItem } from "./components/data-filter-tag-item";
import type { DataFilterConditionValue, DataFilterField } from "./types";

export type DataFilterItemProps = DataFilterField & {
  value: DataFilterConditionValue | undefined;
  onChange: (value: DataFilterConditionValue | undefined) => void;
  onRemove?: () => void;
};

/** A controlled filter condition, independent of the DataFilter toolbar. */
export function DataFilterItem({
  value,
  onChange,
  onRemove,
  ...config
}: DataFilterItemProps) {
  return (
    <DataFilterProvider
      key={config.field}
      filters={[config]}
      value={{ query: "", filter: { [config.field]: value } }}
      onFieldValueChange={(_field, nextValue) => {
        onChange(nextValue as DataFilterConditionValue | undefined);
      }}
    >
      <DataFilterTagItem
        defaultOpen={false}
        item={config}
        showRemoveAction={Boolean(onRemove)}
        onRemove={onRemove}
      />
    </DataFilterProvider>
  );
}
