import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getDataFilterBetweenValue,
  getDataFilterCondition,
  hydrateDataFilterValueFilter,
  isEmptyDataFilterValue,
  normalizeDataFilterValue,
  serializeDataFilterValueFilter,
} from "../utils";
import type { FC, ReactNode } from "react";
import type {
  DataFilterItemProps,
  DataFilterSelectOption,
  DataFilterSortValue,
  DataFilterValue,
} from "../types";

type DataFilterGroups = {
  visibleFilters: Array<DataFilterItemProps>;
  hiddenFilters: Array<DataFilterItemProps>;
};

type DataFilterContextValue = DataFilterGroups & {
  value: DataFilterValue;
  selectOptionCache: Record<string, Record<string, DataFilterSelectOption>>;
  filterValues: Record<string, unknown>;
  cacheSelectOptions: (
    field: string,
    options: Array<DataFilterSelectOption>,
  ) => void;
  setQuery: (query: string) => void;
  setOrderBy: (orderBy: DataFilterSortValue) => void;
  setFilterValue: (field: string, value: unknown) => void;
  setFilterVisible: (field: string, visible: boolean) => void;
  hideFilter: (field: string) => void;
  removeFilter: (field: string) => void;
};

interface DataFilterProviderProps {
  children: ReactNode;
  filters: Array<DataFilterItemProps>;
  value?: DataFilterValue;
  defaultValue?: DataFilterValue;
  onChange?: (value: DataFilterValue) => void;
}

const DataFilterContext = createContext<DataFilterContextValue | null>(null);

const getFilterGroups = (
  filters: Array<DataFilterItemProps>,
  values: Record<string, unknown>,
  visibleFields = new Set<string>(),
): DataFilterGroups => {
  return filters.reduce<DataFilterGroups>(
    (groups, item) => {
      if (
        visibleFields.has(item.field) ||
        !isEmptyDataFilterValue(values[item.field])
      ) {
        groups.visibleFilters.push(item);
      } else {
        groups.hiddenFilters.push(item);
      }

      return groups;
    },
    {
      visibleFilters: [],
      hiddenFilters: [],
    },
  );
};

const getActiveFields = (values: Record<string, unknown>) => {
  return new Set(
    Object.entries(values)
      .filter(([, value]) => !isEmptyDataFilterValue(value))
      .map(([field]) => field),
  );
};

const isIncompleteBetweenValue = (value: unknown) => {
  const condition = getDataFilterCondition(value);

  if (condition.operator !== "$between") {
    return false;
  }

  const range = getDataFilterBetweenValue(condition.value);
  const hasValue = range.some(
    (rangeValue) => !isEmptyDataFilterValue(rangeValue),
  );

  return hasValue && isEmptyDataFilterValue(value);
};

const getSelectValues = (value: unknown) => {
  const rawValue = getDataFilterCondition(value).value;

  if (Array.isArray(rawValue)) {
    return rawValue.filter((optionValue): optionValue is string => {
      return typeof optionValue === "string";
    });
  }

  return typeof rawValue === "string" ? [rawValue] : [];
};

export const useDataFilterContext = () => {
  const context = useContext(DataFilterContext);

  if (!context) {
    throw new Error("DataFilter components must be used within DataFilter.");
  }

  return context;
};

export const DataFilterProvider: FC<DataFilterProviderProps> = ({
  children,
  filters,
  value: controlledValue,
  defaultValue,
  onChange,
}) => {
  const isControlled = typeof controlledValue !== "undefined";
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    normalizeDataFilterValue(defaultValue),
  );
  const rawValue = isControlled ? controlledValue : uncontrolledValue;
  const value = useMemo(() => normalizeDataFilterValue(rawValue), [rawValue]);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>(
    () => hydrateDataFilterValueFilter(value.filter),
  );
  const [visibleFields, setVisibleFields] = useState(() => {
    return getActiveFields(value.filter);
  });
  const [filterGroups, setFilterGroups] = useState(() => {
    return getFilterGroups(filters, value.filter, visibleFields);
  });
  const [selectOptionCache, setSelectOptionCache] = useState<
    Record<string, Record<string, DataFilterSelectOption>>
  >({});
  const requestedSelectResolveKeysRef = useRef<Record<string, string>>({});
  const isMountedRef = useRef(false);

  useEffect(() => {
    const hydratedValues = hydrateDataFilterValueFilter(value.filter);

    setFilterValues((currentValues) => {
      const mergedValues: Record<string, unknown> = { ...hydratedValues };

      for (const item of filters) {
        const currentValue = currentValues[item.field];

        if (
          isIncompleteBetweenValue(currentValue) &&
          isEmptyDataFilterValue(hydratedValues[item.field])
        ) {
          mergedValues[item.field] = currentValue;
        }
      }

      return mergedValues;
    });

    setVisibleFields((currentFields) => {
      return new Set([...currentFields, ...getActiveFields(hydratedValues)]);
    });
  }, [filters, value.filter]);

  useEffect(() => {
    setFilterGroups(getFilterGroups(filters, filterValues, visibleFields));
  }, [filters, filterValues, visibleFields]);

  const emitValueChange = useCallback(
    (nextValue: DataFilterValue) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [isControlled, onChange],
  );

  const createNextValue = useCallback(
    (nextFilterValues: Record<string, unknown>): DataFilterValue => {
      return {
        filter: serializeDataFilterValueFilter(nextFilterValues),
        ...(value.orderBy ? { orderBy: value.orderBy } : {}),
        query: value.query,
      };
    },
    [value.orderBy, value.query],
  );

  const setQuery = useCallback(
    (query: string) => {
      emitValueChange({
        ...createNextValue(filterValues),
        query,
      });
    },
    [createNextValue, emitValueChange, filterValues],
  );

  const setOrderBy = useCallback(
    (orderBy: DataFilterSortValue) => {
      emitValueChange({
        ...createNextValue(filterValues),
        orderBy,
      });
    },
    [createNextValue, emitValueChange, filterValues],
  );

  const cacheSelectOptions = useCallback(
    (field: string, options: Array<DataFilterSelectOption>) => {
      if (options.length === 0) {
        return;
      }

      setSelectOptionCache((currentCache) => {
        const currentFieldCache = currentCache[field] ?? {};
        const nextFieldCache = { ...currentFieldCache };
        let changed = false;

        for (const option of options) {
          const currentOption = currentFieldCache[option.value];

          if (
            currentOption?.label === option.label &&
            currentOption.value === option.value
          ) {
            continue;
          }

          nextFieldCache[option.value] = option;
          changed = true;
        }

        if (!changed) {
          return currentCache;
        }

        return {
          ...currentCache,
          [field]: nextFieldCache,
        };
      });
    },
    [],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    for (const item of filters) {
      if (item.type !== "select" || !item.resolveSelectedOptions) {
        continue;
      }

      const values = getSelectValues(filterValues[item.field]);
      const fieldCache = selectOptionCache[item.field] ?? {};
      const missingValues = values.filter((optionValue) => {
        return !fieldCache[optionValue];
      });

      if (missingValues.length === 0) {
        continue;
      }

      const missingValuesKey = missingValues.join("\0");

      if (
        requestedSelectResolveKeysRef.current[item.field] === missingValuesKey
      ) {
        continue;
      }

      requestedSelectResolveKeysRef.current[item.field] = missingValuesKey;

      void item
        .resolveSelectedOptions(missingValues)
        .then((nextOptions) => {
          if (isMountedRef.current) {
            cacheSelectOptions(item.field, nextOptions);
          }
        })
        .catch(() => {
          // Keep unresolved selected values visible as their raw value.
        });
    }
  }, [cacheSelectOptions, filters, filterValues, selectOptionCache]);

  const setFilterValue = useCallback(
    (field: string, value: unknown) => {
      const nextValues = {
        ...filterValues,
        [field]: value,
      };

      setFilterValues(nextValues);
      emitValueChange(createNextValue(nextValues));
    },
    [createNextValue, emitValueChange, filterValues],
  );

  const setFilterVisible = useCallback((field: string, visible: boolean) => {
    setVisibleFields((currentFields) => {
      const nextFields = new Set(currentFields);

      if (visible) {
        nextFields.add(field);
      } else {
        nextFields.delete(field);
      }

      return nextFields;
    });
  }, []);

  const hideFilter = useCallback(
    (field: string) => {
      setFilterValues((currentValues) => {
        if (!isEmptyDataFilterValue(currentValues[field])) {
          return currentValues;
        }

        const { [field]: _removedValue, ...nextValues } = currentValues;

        return nextValues;
      });

      setFilterVisible(field, false);
    },
    [setFilterVisible],
  );

  const removeFilter = useCallback(
    (field: string) => {
      setFilterValue(field, undefined);
      hideFilter(field);
    },
    [hideFilter, setFilterValue],
  );

  const contextValue = useMemo<DataFilterContextValue>(
    () => ({
      ...filterGroups,
      value,
      selectOptionCache,
      filterValues,
      cacheSelectOptions,
      setQuery,
      setOrderBy,
      setFilterValue,
      setFilterVisible,
      hideFilter,
      removeFilter,
    }),
    [
      filterGroups,
      value,
      selectOptionCache,
      filterValues,
      cacheSelectOptions,
      setQuery,
      setOrderBy,
      setFilterValue,
      setFilterVisible,
      hideFilter,
      removeFilter,
    ],
  );

  return (
    <DataFilterContext.Provider value={contextValue}>
      {children}
    </DataFilterContext.Provider>
  );
};
