import { isEqual } from "lodash";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomCompareEffect } from "react-use";
import { usePageSearch } from "./use-page-search";
import type z from "zod";
import type { PageKey } from "./use-page-search";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

interface CursorPageSearch {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

type PageSearchConditions<Schema extends z.ZodType<CursorPageSearch>> = Omit<
  z.output<Schema>,
  "first" | "last" | "after" | "before"
>;

export interface PageNavigationQueryOptions<
  Schema extends z.ZodType<CursorPageSearch>,
> {
  pageSearch: z.output<Schema>;
}

export interface PageNavigationEdge {
  cursor: string;
  node: { id: string | number };
}

export interface PageNavigationQueryResult {
  previousEdge?: PageNavigationEdge;
  nextEdge?: PageNavigationEdge;
}

type PageNavigationQuery<Schema extends z.ZodType<CursorPageSearch>> = (
  options: PageNavigationQueryOptions<Schema>,
) => Promise<PageNavigationQueryResult | null | undefined>;

interface NavigationRequest<Schema extends z.ZodType<CursorPageSearch>> {
  scope: string;
  query: PageNavigationQuery<Schema>;
  conditions: PageSearchConditions<Schema>;
}

interface NavigationState<Schema extends z.ZodType<CursorPageSearch>> {
  request: NavigationRequest<Schema>;
  loading: boolean;
  data?: PageNavigationQueryResult;
  error?: unknown;
}

interface PageNavigationOptions<Schema extends z.ZodType<CursorPageSearch>> {
  key: PageKey;
  /** Must accept {} and normalize any client-side default ordering. */
  searchSchema: Schema;
  /** A stable closure that executes the application's lazy query. */
  query: PageNavigationQuery<Schema>;
}

/** Queries adjacent records and remembers the list position for returning. */
export function usePageNavigation<Schema extends z.ZodType<CursorPageSearch>>({
  key,
  searchSchema,
  query,
}: PageNavigationOptions<Schema>) {
  const { id: userId } = useCurrentUserContext();
  const requestId = useRef(0);
  const [state, setState] = useState<NavigationState<Schema>>();
  const { pageSearch: savedSearch, setPageSearch } = usePageSearch({
    key,
    searchSchema,
  });
  const pageSearch = useMemo(
    () => savedSearch ?? searchSchema.parse({}),
    [savedSearch, searchSchema],
  );
  const {
    first: _first,
    last: _last,
    after: _after,
    before: _before,
    ...conditions
  } = pageSearch;
  // A saved list position changes independently of the current record’s neighbors.
  const request: NavigationRequest<Schema> = {
    scope: JSON.stringify([userId, ...key]),
    query,
    conditions,
  };

  async function refetch() {
    const id = ++requestId.current;
    setState({ request, loading: true });
    try {
      const data = await query({ pageSearch });
      if (!data) throw new Error("Page navigation query returned no result.");
      if (requestId.current === id) setState({ request, loading: false, data });
      return data;
    } catch (error) {
      if (requestId.current === id)
        setState({ request, loading: false, error });
      throw error;
    }
  }

  useCustomCompareEffect(
    () => {
      void refetch().catch(() => undefined);
      return () => {
        // Ignore completions from an old record, scope, retry, or unmounted page.
        requestId.current++;
      };
    },
    [request],
    isEqual,
  );

  // Also hide stale results during the render before the next effect starts.
  const current = state && isEqual(state.request, request) ? state : undefined;
  const data = current?.data;
  const previousEdge = data?.previousEdge;
  const nextEdge = data?.nextEdge;
  const backSearch = useMemo((): z.output<Schema> => {
    if (!savedSearch || !data) return pageSearch;
    const {
      first,
      last,
      after: _after,
      before: _before,
      ...conditions
    } = savedSearch;
    return searchSchema.parse({
      ...conditions,
      first: first ?? last,
      after: data.previousEdge?.cursor,
    });
  }, [savedSearch, data, pageSearch, searchSchema]);

  useEffect(() => {
    if (!data) return;
    // Direct entry must not create a saved list visit.
    // Search schemas must accept their normalized output, as storage reads do.
    setPageSearch((saved) =>
      saved === undefined ? undefined : (backSearch as z.input<Schema>),
    );
  }, [data, backSearch, setPageSearch]);

  return {
    pageSearch,
    setPageSearch,
    backSearch,
    previousEdge,
    nextEdge,
    loading: !current || current.loading,
    error: current?.error,
    refetch,
  };
}
