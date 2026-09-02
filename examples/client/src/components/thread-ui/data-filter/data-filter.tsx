import {
  DataFilterProvider,
  DataFilterSearch,
  DataFilterSort,
  DataFilterTagList,
  useDataFilterContext,
} from "./components";
import type { FC } from "react";
import type { DataFilterSearchProps } from "./components/data-filter-search";
import type { DataFilterSortProps } from "./components/data-filter-sort";
import type { DataFilterItemProps, DataFilterValue } from "./types";
import { cn } from "@/lib/utils";

export interface DataFilterProps {
  className?: string;
  loading?: boolean;
  filters: Array<DataFilterItemProps>;
  search?: false | DataFilterSearchProps;
  sort?: false | DataFilterSortProps;
  value?: DataFilterValue;
  defaultValue?: DataFilterValue;
  onChange?: (value: DataFilterValue) => void;
}

type DataFilterContentProps = Pick<
  DataFilterProps,
  "className" | "filters" | "loading" | "search" | "sort"
>;

const DataFilterContent: FC<DataFilterContentProps> = ({
  className,
  loading,
  filters,
  search,
  sort,
}) => {
  const { value, setQuery, setOrderBy } = useDataFilterContext();

  return (
    <div
      data-slot="data-filter"
      className={cn(
        "grid grid-cols-1 items-center gap-2 has-[>[data-slot=data-filter-sort]]:grid-cols-[minmax(0,1fr)_auto]",
        "*:data-[slot=data-filter-search]:min-w-0",
        "*:data-[slot=data-filter-sort]:justify-self-end",
        "*:data-[slot=data-filter-tag-list]:col-span-full",
        className,
      )}
    >
      {search !== false && (
        <DataFilterSearch
          {...search}
          loading={loading}
          value={value.query}
          onChange={setQuery}
        />
      )}

      {sort && sort.options.length > 0 && (
        <DataFilterSort
          {...sort}
          selected={value.orderBy}
          onChange={setOrderBy}
        />
      )}

      {filters.length > 0 && <DataFilterTagList />}
    </div>
  );
};

export const DataFilter: FC<DataFilterProps> = ({
  defaultValue,
  filters,
  onChange,
  value,
  ...props
}) => {
  return (
    <DataFilterProvider
      defaultValue={defaultValue}
      filters={filters}
      value={value}
      onChange={onChange}
    >
      <DataFilterContent filters={filters} {...props} />
    </DataFilterProvider>
  );
};
