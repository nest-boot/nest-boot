import { isEqual } from "lodash";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useCustomCompareEffect } from "react-use";
import type z from "zod";

export type ResourceKey = ReadonlyArray<string | number>;

interface ResourceSearchOptions<Schema extends z.ZodType> {
  /** Complete scope; callers include user or workspace IDs when needed. */
  key: ResourceKey;
  searchSchema: Schema;
  /** Synchronize supplied search when it changes; undefined only reads storage. */
  search?: z.input<Schema>;
}

type ResourceSearchUpdater<Schema extends z.ZodType> = (
  previous: z.output<Schema> | undefined,
) => z.input<Schema> | undefined;

type ResourceSearchUpdate<Schema extends z.ZodType> =
  | z.input<Schema>
  | undefined
  | ResourceSearchUpdater<Schema>;

interface Entry {
  value: string | null;
  memoryOnly: boolean;
  listeners: Set<() => void>;
}

const entries = new Map<string, Entry>();

function getEntry(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { value: null, memoryOnly: false, listeners: new Set() };
    entries.set(key, entry);
  }
  return entry;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  const entry = getEntry(key);
  if (!entry.memoryOnly) {
    try {
      entry.value = window.sessionStorage.getItem(key);
    } catch {
      entry.memoryOnly = true;
    }
  }
  return entry.value;
}

function write(key: string, value: string | null) {
  if (typeof window === "undefined" || read(key) === value) return;
  const entry = getEntry(key);
  entry.value = value;
  if (!entry.memoryOnly) {
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch {
      entry.memoryOnly = true;
    }
  }
  entry.listeners.forEach((listener) => listener());
}

function parse<Schema extends z.ZodType>(
  raw: string | null,
  searchSchema: Schema,
): z.output<Schema> | undefined {
  if (raw === null) return undefined;
  try {
    const result = searchSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers validated list search, scoped to the caller-provided resource key. */
function useStoredResourceSearch<Schema extends z.ZodType>(
  options: ResourceSearchOptions<Schema>,
): {
  search: z.output<Schema> | undefined;
  setSearch: (update: ResourceSearchUpdate<Schema>) => void;
} {
  const { key, searchSchema, search: incomingSearch } = options;
  const storageKey = `resource-navigation:${JSON.stringify(key)}`;
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = getEntry(storageKey);
      entry.listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === storageKey) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        entry.listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [storageKey],
  );
  const getSnapshot = useCallback(() => read(storageKey), [storageKey]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const storedSearch = useMemo(
    () => parse(raw, searchSchema),
    [raw, searchSchema],
  );

  const setSearch = useCallback(
    (update: ResourceSearchUpdate<Schema>) => {
      const next =
        typeof update === "function"
          ? (update as ResourceSearchUpdater<Schema>)(
              parse(read(storageKey), searchSchema),
            )
          : update;
      // Validate before writing so invalid updates preserve the last valid value.
      const serialized =
        next === undefined ? null : JSON.stringify(searchSchema.parse(next));
      if (serialized === undefined) {
        throw new TypeError("Resource search must be JSON-serializable.");
      }
      write(storageKey, serialized);
    },
    [storageKey, searchSchema],
  );

  const source = { search: incomingSearch, setSearch };
  const [appliedSource, setAppliedSource] = useState<typeof source>();
  // Supplied URL state is immediately available to a query in the same hook.
  // Once applied, an unchanged input must not overwrite explicit shared updates.
  const pending =
    incomingSearch !== undefined && !isEqual(source, appliedSource);
  const search = useMemo(
    () => (pending ? searchSchema.parse(incomingSearch) : storedSearch),
    [pending, incomingSearch, searchSchema, storedSearch],
  );

  // Router search objects can have a null prototype; compare them as data.
  useCustomCompareEffect(
    () => {
      if (incomingSearch !== undefined) setSearch(incomingSearch);
      setAppliedSource(source);
    },
    [source],
    isEqual,
  );

  useEffect(() => {
    if (
      raw !== null &&
      storedSearch === undefined &&
      read(storageKey) === raw
    ) {
      write(storageKey, null);
    }
  }, [storageKey, raw, storedSearch]);

  return { search, setSearch };
}

interface CursorResourceSearch {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

type ResourceSearchConditions<Schema extends z.ZodType<CursorResourceSearch>> =
  Omit<z.output<Schema>, "first" | "last" | "after" | "before">;

export interface ResourceNavigationQueryOptions<
  Schema extends z.ZodType<CursorResourceSearch>,
> {
  search: z.output<Schema>;
}

export interface ResourceNavigationEdge {
  cursor: string;
  node: { id: string | number };
}

export interface ResourceNavigationQueryResult {
  previousEdge?: ResourceNavigationEdge;
  nextEdge?: ResourceNavigationEdge;
}

type ResourceNavigationQuery<Schema extends z.ZodType<CursorResourceSearch>> = (
  options: ResourceNavigationQueryOptions<Schema>,
) => Promise<ResourceNavigationQueryResult | null | undefined>;

interface NavigationRequest<Schema extends z.ZodType<CursorResourceSearch>> {
  scope: string;
  query?: ResourceNavigationQuery<Schema>;
  conditions: ResourceSearchConditions<Schema>;
}

interface NavigationState<Schema extends z.ZodType<CursorResourceSearch>> {
  request: NavigationRequest<Schema>;
  loading: boolean;
  data?: ResourceNavigationQueryResult;
  error?: unknown;
}

export interface ResourceNavigationOptions<
  Schema extends z.ZodType<CursorResourceSearch>,
> extends ResourceSearchOptions<Schema> {
  /** Must accept {} and normalize any client-side default ordering. */
  searchSchema: Schema;
  /** Details provide a stable closure to query adjacent records; lists may omit it. */
  query?: ResourceNavigationQuery<Schema>;
}

/** Shares resource list search and optionally queries adjacent records for details. */
export function useResourceNavigation<
  Schema extends z.ZodType<CursorResourceSearch>,
>(options: ResourceNavigationOptions<Schema>) {
  const { key, searchSchema, query } = options;
  const requestId = useRef(0);
  const [state, setState] = useState<NavigationState<Schema>>();
  const { search: savedSearch, setSearch } = useStoredResourceSearch(options);
  const clearSearch = useCallback(() => setSearch(undefined), [setSearch]);
  const search = useMemo(
    () => savedSearch ?? searchSchema.parse({}),
    [savedSearch, searchSchema],
  );
  const {
    first: _first,
    last: _last,
    after: _after,
    before: _before,
    ...conditions
  } = search;
  // A saved list position changes independently of the current record’s neighbors.
  const request: NavigationRequest<Schema> = {
    scope: JSON.stringify(key),
    query,
    conditions,
  };

  async function refetch() {
    if (!query) return undefined;
    const id = ++requestId.current;
    setState({ request, loading: true });
    try {
      const data = await query({ search });
      if (!data)
        throw new Error("Resource navigation query returned no result.");
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
      if (query) void refetch().catch(() => undefined);
      return () => {
        // Ignore completions from an old record, scope, retry, or unmounted page.
        requestId.current++;
      };
    },
    [request],
    isEqual,
  );

  // Also hide stale results during the render before the next effect starts.
  const current =
    query && state && isEqual(state.request, request) ? state : undefined;
  const data = current?.data;
  const previousEdge = data?.previousEdge;
  const nextEdge = data?.nextEdge;
  const backSearch = useMemo((): z.output<Schema> => {
    if (!savedSearch || !data) return search;
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
  }, [savedSearch, data, search, searchSchema]);

  useEffect(() => {
    if (!data) return;
    // Direct entry must not create a saved list visit.
    // Search schemas must accept their normalized output, as storage reads do.
    setSearch((saved) =>
      saved === undefined ? undefined : (backSearch as z.input<Schema>),
    );
  }, [data, backSearch, setSearch]);

  return {
    search,
    setSearch,
    clearSearch,
    backSearch,
    previousEdge,
    nextEdge,
    loading: Boolean(query) && (!current || current.loading),
    error: current?.error,
    refetch,
  };
}
