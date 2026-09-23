import { useMemo } from "react";
import { usePageSearch } from "./use-page-search";
import type z from "zod";
import type { PageKey } from "./use-page-search";
import { createConnectionCursor } from "@/lib/connection-cursor";

interface CursorPageSearch {
  orderBy?: { field: string } | null;
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

interface PageNavigationOptions<
  Schema extends z.ZodType<CursorPageSearch>,
  Record extends { id: string },
> {
  key: PageKey;
  /** Must accept {} and normalize any client-side default ordering. */
  searchSchema: Schema;
  /** Must include the id and, when ordered, the field selected by orderBy.field. */
  record: Record;
}

/** Derives cursor navigation from live record data; only list search is stored. */
export function usePageNavigation<
  Schema extends z.ZodType<CursorPageSearch>,
  Record extends { id: string },
>({ key, searchSchema, record }: PageNavigationOptions<Schema, Record>) {
  const { search: savedSearch } = usePageSearch({ key, searchSchema });
  const search = useMemo(
    () => savedSearch ?? searchSchema.parse({}),
    [savedSearch, searchSchema],
  );
  const currentCursor = createConnectionCursor(record, search.orderBy?.field);
  const { first, last, after: _after, before: _before, ...conditions } = search;

  return {
    search,
    currentCursor,
    previousSearch: { ...conditions, last: 1, before: currentCursor },
    nextSearch: { ...conditions, first: 1, after: currentCursor },
    /** No saved search uses defaults; an absent previous cursor means page one. */
    getBackSearch(previousCursor?: string | null): z.output<Schema> {
      if (!savedSearch) return search;
      return searchSchema.parse({
        ...conditions,
        first: first ?? last,
        after: previousCursor ?? undefined,
      });
    },
  };
}
