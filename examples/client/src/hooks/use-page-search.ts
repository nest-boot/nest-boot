import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type z from "zod";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

export type PageKey = ReadonlyArray<string | number>;

export interface PageSearchOptions<Schema extends z.ZodType> {
  key: PageKey;
  searchSchema: Schema;
}

type PageSearchUpdater<Schema extends z.ZodType> = (
  previous: z.output<Schema> | undefined,
) => z.input<Schema> | undefined;

type PageSearchUpdate<Schema extends z.ZodType> =
  | z.input<Schema>
  | undefined
  | PageSearchUpdater<Schema>;

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

/** Remembers validated list search, scoped to the current user and page key. */
export function usePageSearch<Schema extends z.ZodType>({
  key,
  searchSchema,
}: PageSearchOptions<Schema>): {
  pageSearch: z.output<Schema> | undefined;
  setPageSearch: (update: PageSearchUpdate<Schema>) => void;
} {
  const { id: userId } = useCurrentUserContext();
  const storageKey = `page-search:v1:${JSON.stringify([userId, ...key])}`;
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
  const pageSearch = useMemo(
    () => parse(raw, searchSchema),
    [raw, searchSchema],
  );

  const setPageSearch = useCallback(
    (update: PageSearchUpdate<Schema>) => {
      const next =
        typeof update === "function"
          ? (update as PageSearchUpdater<Schema>)(
              parse(read(storageKey), searchSchema),
            )
          : update;
      // Validate before writing so invalid updates preserve the last valid value.
      const serialized =
        next === undefined ? null : JSON.stringify(searchSchema.parse(next));
      if (serialized === undefined) {
        throw new TypeError("Page search must be JSON-serializable.");
      }
      write(storageKey, serialized);
    },
    [storageKey, searchSchema],
  );

  useEffect(() => {
    if (raw !== null && pageSearch === undefined && read(storageKey) === raw) {
      write(storageKey, null);
    }
  }, [storageKey, raw, pageSearch]);

  return { pageSearch, setPageSearch };
}
