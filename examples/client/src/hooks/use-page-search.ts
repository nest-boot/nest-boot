import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type z from "zod";
import { useCurrentUserContext } from "@/app/_authenticated/contexts/current-user-context";

export type PageKey = ReadonlyArray<string | number>;

export interface PageSearchOptions<Schema extends z.ZodType> {
  searchSchema: Schema;
  /** Omit to read only. An empty object explicitly replaces the saved search. */
  search?: z.input<Schema>;
}

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
export function usePageSearch<Schema extends z.ZodType>(
  pageKey: PageKey,
  { searchSchema, search }: PageSearchOptions<Schema>,
): { search: z.output<Schema> | undefined } {
  const { id: userId } = useCurrentUserContext();
  const key = `page-search:v1:${JSON.stringify([userId, ...pageKey])}`;
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = getEntry(key);
      entry.listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        entry.listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(() => read(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const savedSearch = useMemo(
    () => parse(raw, searchSchema),
    [raw, searchSchema],
  );

  // Serialize a validated value so unrelated URL fields are not persisted.
  let serialized: string | null | undefined;
  if (search !== undefined) {
    try {
      const result = searchSchema.safeParse(search);
      serialized = result.success ? JSON.stringify(result.data) : null;
    } catch {
      serialized = null;
    }
  }

  useEffect(() => {
    if (serialized !== undefined) write(key, serialized);
    else if (raw !== null && savedSearch === undefined && read(key) === raw) {
      write(key, null);
    }
  }, [key, serialized, raw, savedSearch]);

  return { search: savedSearch };
}
