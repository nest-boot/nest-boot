import { useMemo } from "react";
import { usePageSearch } from "./use-page-search";
import type z from "zod";
import type { PageKey } from "./use-page-search";

interface CursorPageSearch {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

interface PageNavigationOptions<
  Schema extends z.ZodType<CursorPageSearch>,
  Record,
> {
  /** Must accept {} to provide the direct-entry defaults. */
  searchSchema: Schema;
  record: Record;
  getCursor: (record: Record, search: z.output<Schema>) => string;
}

/** Derives cursor navigation from live record data; only list search is stored. */
export function usePageNavigation<
  Schema extends z.ZodType<CursorPageSearch>,
  Record,
>(
  pageKey: PageKey,
  { searchSchema, record, getCursor }: PageNavigationOptions<Schema, Record>,
) {
  const { search: savedSearch } = usePageSearch(pageKey, { searchSchema });
  const search = useMemo(
    () => savedSearch ?? searchSchema.parse({}),
    [savedSearch, searchSchema],
  );
  const currentCursor = getCursor(record, search);
  const { first, last, after: _after, before: _before, ...conditions } = search;

  return {
    search,
    currentCursor,
    previousSearch: { ...conditions, last: 1, before: currentCursor },
    nextSearch: { ...conditions, first: 1, after: currentCursor },
    /** undefined means not loaded; null means the current record is first. */
    getReturnSearch(
      previousCursor: string | null | undefined,
    ): z.output<Schema> {
      if (previousCursor === undefined) return search;
      return searchSchema.parse({
        ...conditions,
        first: first ?? last,
        after: previousCursor ?? undefined,
      });
    },
  };
}
