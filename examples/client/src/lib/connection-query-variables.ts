import {
  formatConnectionFilterValue,
  formatFilterValues,
} from "@/lib/format-filter-values";

/** Share normalized query conditions between lists and adjacent-record queries. */
export function createConnectionQueryVariables<
  Search extends { query?: string; filter?: unknown },
>(search: Search) {
  const { query, filter, ...rest } = search;
  return {
    ...rest,
    query: query ?? "",
    filter: formatFilterValues(
      (filter ?? {}) as Record<string, unknown>,
      formatConnectionFilterValue,
    ),
  };
}
